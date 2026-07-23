// src/components/ScheduledCallReminder.jsx
import React from 'react';

const ScheduledCallReminder = ({ call, onJoin }) => {
  if (!call) return null;

  return (
    <div style={{ position: 'fixed', bottom: '1rem', right: '1rem', background: '#2196F3', color: 'white', padding: '1rem', borderRadius: '0.5rem', zIndex: 999 }}>
      <p>Scheduled call starting now: {call.type} call</p>
      <button onClick={onJoin} style={{ marginRight: '0.5rem' }}>Join</button>
    </div>
  );
};

export default ScheduledCallReminder;