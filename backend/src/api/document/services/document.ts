import type { Core } from '@strapi/strapi';

export default {
  /**
   * Returns a document with owner and collaborators populated.
   * Uses the Strapi v5 Document Service API.
   */
  async findWithRelations(documentId: string) {
    const strapi: Core.Strapi = (globalThis as any).strapi;
    return (strapi.documents as any)('api::document.document').findOne({
      documentId,
      populate: ['owner', 'collaborators'],
    });
  },

  /**
   * Lists all documents (no ownership filter — use the controller for that).
   */
  async findAll() {
    const strapi: Core.Strapi = (globalThis as any).strapi;
    return (strapi.documents as any)('api::document.document').findMany({
      populate: ['owner', 'collaborators'],
      sort:     'updatedAt:desc',
    });
  },
};


// // backend/src/api/document/services/document.ts
// // Strapi v5 — uses strapi.documents() instead of entityService.

// import { factories } from '@strapi/strapi';

// export default factories.createCoreService(
//   'api::document.document' as any,
//   ({ strapi }) => ({
//     /**
//      * Returns a single document with owner and collaborators populated.
//      * Pass the Strapi v5 documentId string (not the numeric DB id).
//      */
//     async findWithRelations(documentId: string) {
//       return (strapi.documents as any)(
//         'api::document.document'
//       ).findOne({
//         documentId,
//         populate: ['owner', 'collaborators'],
//       });
//     },
//   })
// );
