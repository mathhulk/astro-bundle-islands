import { AstroIntegration } from "astro";
import bundleIslands from "./bundle.ts";

const createIntegration = () => {
  const integration: AstroIntegration = {
    name: "astro-bundle-islands",
    hooks: {
      "astro:build:done": async ({ assets, dir, logger }) => {
        await bundleIslands(assets, dir, logger);
      },
    },
  };

  return integration;
};

export default createIntegration;
