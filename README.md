Modern browsers prevent dynamically importing JavaScript modules in insecure contexts, such as when opening HTML files directly from the file system over the `file://` protocol.

Bundling dynamic imports into a single JavaScript file circumvents this measure and allows Astro islands to hydrate properly in insecure contexts.

This solution is not meant to work for everyone, but feel free to open an issue in case I feel adventurous.

```ts
// @ts-check
import { defineConfig } from "astro/config";
import relativeLinks from "astro-relative-links";

import bundleIslands from "astro-bundle-islands";

// https://astro.build/config
export default defineConfig({
  integrations: [
    // Recommended
    relativeLinks(),

    bundleIslands()
  ],
});
```
