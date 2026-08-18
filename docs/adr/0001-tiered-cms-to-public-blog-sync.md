# Tiered CMS-to-Public-Blog synchronization

The CMS will use tiered synchronization for changes that affect the Public Blog: small site profile updates use Runtime Sync so they can appear within 1 second, while structural and static-content changes use Build Sync with visible status and a 30-90 second target. This keeps common appearance edits fast without pretending that content, navigation, taxonomy, SEO, and other static-output changes can avoid a rebuild safely.
