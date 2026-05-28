import adapter from "@sveltejs/adapter-node";

const csrfTrustedOrigins = process.env.CSRF_TRUSTED_ORIGINS
  ? process.env.CSRF_TRUSTED_ORIGINS.split(",").map((s) => s.trim())
  : [];

const config = {
  kit: {
    adapter: adapter({ precompress: true }),
    alias: {
      $lib: "./src/lib",
    },
    csrf: {
      trustedOrigins: csrfTrustedOrigins,
    },
  },
};

export default config;
