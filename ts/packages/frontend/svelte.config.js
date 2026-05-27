import adapter from "@sveltejs/adapter-node";

const config = {
  kit: {
    adapter: adapter({ precompress: true }),
    alias: {
      $lib: "./src/lib",
    },
  },
};

export default config;
