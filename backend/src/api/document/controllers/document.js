// backend/src/api/document/controllers/document.js
// Extends the default Strapi CRUD controller with:
//  - ownership enforcement (users only see their own docs + shared docs)
//  - auto-assign owner on create

'use strict';

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController(
  'api::document.document',
  ({ strapi }) => ({
    // -----------------------------------------------------------------------
    // GET /api/documents
    // Returns docs owned by the current user OR shared with them
    // -----------------------------------------------------------------------
    async find(ctx) {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized('You must be logged in.');

      const { data, meta } = await super.find(ctx);

      // Filter: owner = me OR collaborators includes me
      // (For simplicity we do this in-process; for large datasets add a
      //  Strapi service filter on the DB query instead.)
      const filtered = data.filter((doc) => {
        const ownerId = doc.attributes?.owner?.data?.id;
        const collaboratorIds = (
          doc.attributes?.collaborators?.data || []
        ).map((c) => c.id);
        return ownerId === userId || collaboratorIds.includes(userId);
      });

      return { data: filtered, meta };
    },

    // -----------------------------------------------------------------------
    // POST /api/documents
    // Auto-assigns the logged-in user as owner
    // -----------------------------------------------------------------------
    async create(ctx) {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized('You must be logged in.');

      // Inject owner into request body
      ctx.request.body.data = {
        ...ctx.request.body.data,
        owner: userId,
        lastSavedAt: new Date(),
      };

      const response = await super.create(ctx);
      return response;
    },

    // -----------------------------------------------------------------------
    // PUT /api/documents/:id
    // Only owner or collaborators can update
    // -----------------------------------------------------------------------
    async update(ctx) {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized();

      const doc = await strapi.entityService.findOne(
        'api::document.document',
        ctx.params.id,
        { populate: ['owner', 'collaborators'] }
      );

      if (!doc) return ctx.notFound();

      const isOwner = doc.owner?.id === userId;
      const isCollaborator = doc.collaborators?.some((c) => c.id === userId);

      if (!isOwner && !isCollaborator) {
        return ctx.forbidden('You do not have permission to edit this document.');
      }

      return super.update(ctx);
    },

    // -----------------------------------------------------------------------
    // DELETE /api/documents/:id
    // Only owner can delete
    // -----------------------------------------------------------------------
    async delete(ctx) {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized();

      const doc = await strapi.entityService.findOne(
        'api::document.document',
        ctx.params.id,
        { populate: ['owner'] }
      );

      if (!doc) return ctx.notFound();
      if (doc.owner?.id !== userId) {
        return ctx.forbidden('Only the document owner can delete it.');
      }

      return super.delete(ctx);
    },

    // -----------------------------------------------------------------------
    // POST /api/documents/:id/share
    // Add a collaborator by email
    // -----------------------------------------------------------------------
    async share(ctx) {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized();

      const { email } = ctx.request.body;
      if (!email) return ctx.badRequest('email is required');

      const doc = await strapi.entityService.findOne(
        'api::document.document',
        ctx.params.id,
        { populate: ['owner', 'collaborators'] }
      );

      if (!doc) return ctx.notFound();
      if (doc.owner?.id !== userId) {
        return ctx.forbidden('Only the owner can share this document.');
      }

      // Find user by email
      const targetUser = await strapi.db
        .query('plugin::users-permissions.user')
        .findOne({ where: { email } });

      if (!targetUser) return ctx.notFound('User with that email not found.');

      const existingIds = (doc.collaborators || []).map((c) => c.id);
      if (!existingIds.includes(targetUser.id)) {
        existingIds.push(targetUser.id);
      }

      await strapi.entityService.update('api::document.document', doc.id, {
        data: { collaborators: existingIds },
      });

      return ctx.send({ message: `Shared with ${email}` });
    },
  })
);
