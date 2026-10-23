// services/callCleanupService.js
import { RoomServiceClient } from 'livekit-server-sdk';
import Call from '../models/call.js';
import { getIO } from '../controllers/socket.js';
import { finalizeCallNotes } from './callAIService.js';

// ─────────────────────────────────────────────────────────────
// Config — edit these numbers to change the behaviour
// ─────────────────────────────────────────────────────────────
const CHECK_INTERVAL_MS = 15_000;          // how often we look at ongoing calls
const EMPTY_GRACE_MS = 60_000;             // room empty this long → end call (1 minute)
const NEVER_JOINED_MS = 30 * 60_000;       // nobody ever connected → end after 30 min

// ─────────────────────────────────────────────────────────────
// LiveKit client (checks who is REALLY in the room)
// Uses LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET.
// If your env var names differ, change them here.
// ─────────────────────────────────────────────────────────────
let roomClient = null;

const getRoomClient = () => {
  if (roomClient) return roomClient;
  const url = (process.env.LIVEKIT_URL || '').replace(/^wss?:/, 'https:');
  if (!url || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    return null;
  }
  roomClient = new RoomServiceClient(
    url,
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET
  );
  return roomClient;
};

// Returns the number of people in the LiveKit room, or null if we
// couldn't find out (network/auth error). null means "do nothing".
const countLiveParticipants = async (roomId) => {
  const client = getRoomClient();
  if (!client) return null;
  try {
    const list = await client.listParticipants(roomId);
    return Array.isArray(list) ? list.length : 0;
  } catch (err) {
    const msg = String(err?.message || '').toLowerCase();
    // Room doesn't exist on LiveKit (never created, or already auto-closed)
    if (err?.code === 'not_found' || err?.status === 404 || msg.includes('not exist') || msg.includes('not found')) {
      return 0;
    }
    console.error(`[callCleanup] LiveKit check failed for ${roomId}:`, err.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// End a call (same result as the host pressing "End for everyone")
// ─────────────────────────────────────────────────────────────
const endCallAutomatically = async (callId, reason) => {
  const call = await Call.findById(callId);
  if (!call || call.status !== 'ongoing') return;

  // Safety re-check: if someone rejoined since we decided, don't end it
  if (reason === 'everyone-left' && !call.presence?.emptySince) return;

  const now = new Date();

  call.status = 'ended';
  call.endedAt = now;
  call.endedReason = reason;
  call.presence = { everOccupied: !!call.presence?.everOccupied, emptySince: null };

  call.participants.forEach((p) => {
    if (p.status === 'ringing' || p.status === 'pending') p.status = 'missed';
    else if (p.status === 'accepted') {
      p.status = 'left';
      p.leftAt = p.leftAt || now;
    }
  });
  (call.guests || []).forEach((g) => {
    if (!g.leftAt) g.leftAt = now;
  });

  const shouldFinalizeAI = !!call.ai?.enabled;
  if (shouldFinalizeAI) {
    call.ai.enabled = false;
    call.ai.stoppedAt = now;
  }

  await call.save();

  try {
    const io = getIO();
    io.to(`room:${call.roomId}`).emit('call-ended', {
      callId: call._id,
      roomId: call.roomId,
      reason,
    });
    if (call.workspace) {
      io.to(`workspace:${call.workspace}`).emit('call-log-updated', {
        callId: String(call._id),
        status: 'ended',
      });
    }
  } catch (err) {
    console.error('[callCleanup] socket emit failed:', err.message);
  }

  if (shouldFinalizeAI) {
    finalizeCallNotes(call._id).catch((err) =>
      console.error('[callCleanup] finalize notes failed:', err.message)
    );
  }

  console.log(`🛑 [callCleanup] Ended call ${call._id} (${reason})`);
};

// ─────────────────────────────────────────────────────────────
// One pass over all ongoing calls
// ─────────────────────────────────────────────────────────────
let running = false;

export const runCallCleanup = async () => {
  if (running) return; // don't overlap with a slow previous pass
  running = true;

  try {
    const calls = await Call.find({ status: 'ongoing' })
      .select('roomId startedAt createdAt presence')
      .lean();

    const now = Date.now();

    for (const c of calls) {
      try {
        const live = await countLiveParticipants(c.roomId);
        if (live === null) continue; // couldn't check → leave it alone

        const everOccupied = !!c.presence?.everOccupied;
        const emptySince = c.presence?.emptySince
          ? new Date(c.presence.emptySince).getTime()
          : null;

        // ── Someone is in the room ─────────────────────────
        if (live > 0) {
          if (!everOccupied || emptySince) {
            await Call.updateOne(
              { _id: c._id },
              { $set: { 'presence.everOccupied': true, 'presence.emptySince': null } }
            );
          }
          continue;
        }

        // ── Room is empty, and nobody has EVER been in it ──
        if (!everOccupied) {
          const startedMs = new Date(c.startedAt || c.createdAt).getTime();
          if (now - startedMs >= NEVER_JOINED_MS) {
            await endCallAutomatically(c._id, 'never-joined');
          }
          continue;
        }

        // ── Room is empty, but people were here before ─────
        if (!emptySince) {
          await Call.updateOne(
            { _id: c._id },
            { $set: { 'presence.emptySince': new Date() } }
          );
          continue;
        }

        if (now - emptySince >= EMPTY_GRACE_MS) {
          await endCallAutomatically(c._id, 'everyone-left');
        }
      } catch (err) {
        console.error(`[callCleanup] error on call ${c._id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[callCleanup] pass failed:', err);
  } finally {
    running = false;
  }
};

export const startCallCleanup = (intervalMs = CHECK_INTERVAL_MS) => {
  const id = setInterval(() => {
    runCallCleanup().catch((e) => console.error('[callCleanup] error:', e));
  }, intervalMs);
  console.log('✅ Call cleanup started');
  return id;
};