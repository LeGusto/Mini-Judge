module.exports = {
  settings: {
    tmp_file_TTL: 300000, // 5 minutes
    max_file_size: 1024 * 1024, // 1MB
    performance: {
      // Performance consistency settings
      cpu_affinity: "0", // Pin to CPU core 0
      container_prewarm: true, // Enable container pre-warming
      prewarm_timeout: 30000, // 30 seconds
      consistent_timing: true, // Use high-precision timing
      // System optimizations
      disable_swap: true, // Disable swap for consistent memory
      cpu_governor: "performance", // Use performance CPU governor
      io_scheduler: "deadline" // Use deadline I/O scheduler
    }
  }
};
