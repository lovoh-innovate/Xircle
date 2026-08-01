// screens/Welcome.jsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { FaSignInAlt, FaUserPlus, FaArrowRight, FaCheckCircle } from 'react-icons/fa';
import { motion } from 'framer-motion';

const Welcome = () => {
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);

  // Redirect authenticated users
  useEffect(() => {
    if (userInfo) {
      navigate('/my-workspaces', { replace: true });
    }
  }, [userInfo, navigate]);

  const features = [
    'Organize projects into clear workspaces',
    'Assign, track, and close tasks fast',
    'Stay in sync with your whole team',
  ];

  return (
    <div className="min-h-screen w-full bg-white dark:bg-[#0a0a0f] transition-colors duration-300">
      {/* ────────────────────────────────────────────────────────────
          MOBILE LAYOUT (< lg) — hero image-style panel + bottom sheet
      ──────────────────────────────────────────────────────────── */}
      <div className="lg:hidden relative min-h-screen flex flex-col overflow-hidden">
        {/* Hero panel */}
        <div className="relative flex-[1.1] min-h-[58vh] flex flex-col items-center justify-center px-6 overflow-hidden">
          {/* Background image */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/hero.jfif')" }}
          />
          {/* Teal overlay for legibility + brand tint */}
          <div className="absolute inset-0 bg-gradient-to-b from-teal-900/60 via-teal-800/70 to-teal-950/90" />

          {/* decorative blobs */}
          <motion.div
            animate={{ scale: [1, 1.15, 1], rotate: [0, 8, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-24 -right-24 w-72 h-72 bg-teal-400/20 rounded-full blur-3xl pointer-events-none"
          />
          <motion.div
            animate={{ scale: [1, 1.1, 1], rotate: [0, -6, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="absolute -bottom-20 -left-20 w-64 h-64 bg-teal-300/10 rounded-full blur-3xl pointer-events-none"
          />

          <motion.img
            initial={{ opacity: 0, y: -10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            src="/logo.jpeg"
            alt="Xircle logo"
            className="relative z-10 w-20 h-20 rounded-2xl object-cover shadow-xl shadow-black/20 border border-white/20"
          />

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="relative z-10 mt-5 text-3xl font-extrabold text-white tracking-tight"
          >
            Xircle
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.6 }}
            className="relative z-10 mt-2 text-teal-100/90 text-sm text-center max-w-[240px]"
          >
            Projects and tasks, all in one circle
          </motion.p>
        </div>

        {/* Bottom sheet */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
          className="relative z-10 -mt-8 flex-1 bg-white dark:bg-[#14141a] rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.08)] px-7 pt-9 pb-10 flex flex-col"
        >
          <h2 className="text-2xl font-extrabold text-gray-800 dark:text-white tracking-tight">
            Welcome
          </h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400 text-[15px] leading-relaxed">
            Manage your work, your way. <br />
            Where every project finds its flow.
          </p>

          <div className="mt-7 space-y-4">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/login')}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-2xl font-semibold text-[15px] shadow-md shadow-teal-600/20 transition-colors duration-200"
            >
              <FaSignInAlt />
              <span>Log In</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/signup')}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-transparent border-2 border-teal-200 dark:border-teal-700/50 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-2xl font-semibold text-[15px] transition-colors duration-200"
            >
              <FaUserPlus />
              <span>Sign Up</span>
            </motion.button>
          </div>

          <p className="mt-auto pt-8 text-center text-xs text-gray-400 dark:text-gray-500">
            By continuing you agree to Xircle's Terms & Privacy Policy
          </p>
        </motion.div>
      </div>

      {/* ────────────────────────────────────────────────────────────
          DESKTOP LAYOUT (>= lg) — split screen
      ──────────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex min-h-screen">
        {/* Left brand panel */}
        <div className="relative w-[46%] xl:w-[42%] flex flex-col justify-between overflow-hidden px-14 py-14">
          {/* Background image */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/hero.jfif')" }}
          />
          {/* Teal overlay for legibility + brand tint */}
          <div className="absolute inset-0 bg-gradient-to-br from-teal-900/65 via-teal-800/75 to-teal-950/90" />

          <motion.div
            animate={{ scale: [1, 1.12, 1], rotate: [0, 6, 0] }}
            transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-32 -right-32 w-[420px] h-[420px] bg-teal-400/20 rounded-full blur-3xl pointer-events-none"
          />
          <motion.div
            animate={{ scale: [1, 1.1, 1], rotate: [0, -8, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
            className="absolute -bottom-40 -left-24 w-[380px] h-[380px] bg-teal-300/10 rounded-full blur-3xl pointer-events-none"
          />

          {/* Logo + name */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative z-10 flex items-center gap-3"
          >
            <img
              src="/logo.jpeg"
              alt="Xircle logo"
              className="w-11 h-11 rounded-xl object-cover shadow-lg border border-white/20"
            />
            <span className="text-white text-xl font-bold tracking-tight">Xircle</span>
          </motion.div>

          {/* Middle content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="relative z-10 max-w-md"
          >
            <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight tracking-tight">
              Bring your projects <br /> full circle.
            </h1>
            <p className="mt-5 text-teal-100/80 text-lg leading-relaxed">
              Plan, assign, and track every task with your team — all in one clean, connected workspace.
            </p>

            <ul className="mt-8 space-y-3">
              {features.map((f, i) => (
                <motion.li
                  key={f}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.1, duration: 0.5 }}
                  className="flex items-center gap-3 text-teal-50/90 text-[15px]"
                >
                  <FaCheckCircle className="text-teal-300 shrink-0" />
                  <span>{f}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="relative z-10 text-teal-100/50 text-sm"
          >
            © {new Date().getFullYear()} Xircle. All rights reserved.
          </motion.p>
        </div>

        {/* Right welcome / auth panel */}
        <div className="flex-1 flex items-center justify-center px-10 bg-white dark:bg-[#0a0a0f]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="w-full max-w-md"
          >
            <h2 className="text-3xl font-extrabold text-gray-800 dark:text-white tracking-tight">
              Welcome back
            </h2>
            <p className="mt-3 text-gray-500 dark:text-gray-400 text-[15px] leading-relaxed">
              Sign in to pick up where you left off, or create an account to get your workspace started.
            </p>

            <div className="mt-9 space-y-4">
              <motion.button
                whileHover={{ scale: 1.02, boxShadow: '0 18px 30px -12px rgba(13,148,136,0.35)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/login')}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-2xl font-semibold text-[15px] shadow-md transition-colors duration-200 group"
              >
                <FaSignInAlt />
                <span>Log In</span>
                <FaArrowRight className="text-sm group-hover:translate-x-1 transition-transform" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/signup')}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white dark:bg-[#1a1a22] border-2 border-teal-200 dark:border-teal-700/50 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-2xl font-semibold text-[15px] transition-colors duration-200"
              >
                <FaUserPlus />
                <span>Create an account</span>
              </motion.button>
            </div>

            <div className="mt-8 flex items-center gap-4">
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs text-gray-400 dark:text-gray-500">Xircle</span>
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            </div>

            <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
              By continuing you agree to Xircle's Terms & Privacy Policy
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;