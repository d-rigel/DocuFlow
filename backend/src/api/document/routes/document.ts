export default {
  routes: [
    {
      method:  'GET',
      path:    '/documents',
      handler: 'document.find',
      config:  { policies: [], middlewares: [] },
    },
    {
      method:  'GET',
      path:    '/documents/:id',
      handler: 'document.findOne',
      config:  { policies: [], middlewares: [] },
    },
    {
      method:  'POST',
      path:    '/documents',
      handler: 'document.create',
      config:  { policies: [], middlewares: [] },
    },
    {
      method:  'PUT',
      path:    '/documents/:id',
      handler: 'document.update',
      config:  { policies: [], middlewares: [] },
    },
    {
      method:  'DELETE',
      path:    '/documents/:id',
      handler: 'document.delete',
      config:  { policies: [], middlewares: [] },
    },

    // ── Custom ─────────────────────────────────────────────────────────────
    {
      method:  'POST',
      path:    '/documents/:id/share',
      handler: 'document.share',
      config:  { policies: [], middlewares: [] },
    },
  ],
};




// // backend/src/api/document/routes/document.ts
// //
// // Strapi v5: DO NOT use factories.createCoreRouter() in a custom route file.
// // createCoreRouter() lazily reads the content-type's `kind` property, but at
// // the time this module is evaluated the content type isn't registered yet,
// // causing: "Cannot read properties of undefined (reading 'kind')".
// //
// // Solution: define ALL routes (CRUD + custom) explicitly as a plain array.
// // Strapi v5 will wire them up correctly from this export.

// export default {
//   routes: [
//     // ── Standard CRUD ──────────────────────────────────────────────────────
//     {
//       method:  'GET',
//       path:    '/documents',
//       handler: 'document.find',
//       config:  { policies: [], middlewares: [] },
//     },
//     {
//       method:  'GET',
//       path:    '/documents/:id',
//       handler: 'document.findOne',
//       config:  { policies: [], middlewares: [] },
//     },
//     {
//       method:  'POST',
//       path:    '/documents',
//       handler: 'document.create',
//       config:  { policies: [], middlewares: [] },
//     },
//     {
//       method:  'PUT',
//       path:    '/documents/:id',
//       handler: 'document.update',
//       config:  { policies: [], middlewares: [] },
//     },
//     {
//       method:  'DELETE',
//       path:    '/documents/:id',
//       handler: 'document.delete',
//       config:  { policies: [], middlewares: [] },
//     },

//     // ── Custom ─────────────────────────────────────────────────────────────
//     {
//       method:  'POST',
//       path:    '/documents/:id/share',
//       handler: 'document.share',
//       config:  { policies: [], middlewares: [] },
//     },
//   ],
// };
