Modern browsers prevent dynamically importing JavaScript modules in insecure contexts, such as when opening HTML files directly from the file system over the `file://` protocol.

Bundling dynamic imports into a single JavaScript file circumvents this measure and allows Astro islands to hydrate properly in insecure contexts.

> [!WARNING]
> Do not expect this plugin to work for every use case.

### Install automatically with Astro
```
astro add astro-bundle-islands
```

### Install manually
```
npm install astro-bundle-islands
```
```ts
// @ts-check
import { defineConfig } from "astro/config";

import bundleIslands from "astro-bundle-islands";

// https://astro.build/config
export default defineConfig({
  integrations: [
    bundleIslands()
  ],
});
```

I also recommend [astro-relative-links](https://github.com/ixkaito/astro-relative-links).
