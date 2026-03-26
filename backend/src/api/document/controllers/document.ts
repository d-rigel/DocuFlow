import type { Core } from '@strapi/strapi';

// Helper — returns the string identifier for the logged-in user
// (Strapi v5 exposes documentId on the user object; fall back to id)
function getUserId(ctx: any): string | undefined {
  const u = ctx.state.user;
  if (!u) return undefined;
  return String(u.documentId ?? u.id);
}

const documentService = (strapi: Core.Strapi) =>
  (strapi.documents as any)('api::document.document');

export default {
  // -------------------------------------------------------------------------
  // GET /api/documents
  // Returns documents where the caller is owner OR collaborator.
  // -------------------------------------------------------------------------
  async find(ctx: any) {
    const strapi: Core.Strapi = (globalThis as any).strapi;
    const userId = getUserId(ctx);
    if (!userId) return ctx.unauthorized('You must be logged in.');

    const results: any[] = await documentService(strapi).findMany({
      populate: ['owner', 'collaborators'],
      sort:     'updatedAt:desc',
    });

    const filtered = results.filter((doc: any) => {
      const ownerDocId = String(doc.owner?.documentId ?? doc.owner?.id ?? '');
      const collabIds  = (doc.collaborators ?? []).map(
        (c: any) => String(c.documentId ?? c.id)
      );
      return ownerDocId === userId || collabIds.includes(userId);
    });

    return ctx.send({ data: filtered });
  },

  // -------------------------------------------------------------------------
  // GET /api/documents/:id
  // -------------------------------------------------------------------------
  async findOne(ctx: any) {
    const strapi: Core.Strapi = (globalThis as any).strapi;
    const userId = getUserId(ctx);
    if (!userId) return ctx.unauthorized();

    const doc = await documentService(strapi).findOne({
      documentId: ctx.params.id,
      populate:   ['owner', 'collaborators'],
    });

    if (!doc) return ctx.notFound();

    const ownerDocId = String(doc.owner?.documentId ?? doc.owner?.id ?? '');
    const collabIds  = (doc.collaborators ?? []).map(
      (c: any) => String(c.documentId ?? c.id)
    );
    const hasAccess = ownerDocId === userId || collabIds.includes(userId);

    if (!hasAccess) return ctx.forbidden('You do not have access to this document.');

    return ctx.send({ data: doc });
  },

  // -------------------------------------------------------------------------
  // POST /api/documents
  // Auto-assigns the logged-in user as owner.
  // -------------------------------------------------------------------------
  async create(ctx: any) {
    const strapi: Core.Strapi = (globalThis as any).strapi;
    const userId = getUserId(ctx);
    if (!userId) return ctx.unauthorized('You must be logged in.');

    const body = ctx.request.body?.data ?? ctx.request.body ?? {};

    const doc = await documentService(strapi).create({
      data: {
        ...body,
        owner:       userId,
        lastSavedAt: new Date(),
      },
      populate: ['owner', 'collaborators'],
    });

    return ctx.send({ data: doc });
  },

  // -------------------------------------------------------------------------
  // PUT /api/documents/:id
  // Only owner or collaborators can update.
  // -------------------------------------------------------------------------
  async update(ctx: any) {
    const strapi: Core.Strapi = (globalThis as any).strapi;
    const userId = getUserId(ctx);
    if (!userId) return ctx.unauthorized();

    const existing = await documentService(strapi).findOne({
      documentId: ctx.params.id,
      populate:   ['owner', 'collaborators'],
    });

    if (!existing) return ctx.notFound();

    const ownerDocId     = String(existing.owner?.documentId ?? existing.owner?.id ?? '');
    const isOwner        = ownerDocId === userId;
    const isCollaborator = (existing.collaborators ?? []).some(
      (c: any) => String(c.documentId ?? c.id) === userId
    );

    if (!isOwner && !isCollaborator) {
      return ctx.forbidden('You do not have permission to edit this document.');
    }

    const body = ctx.request.body?.data ?? ctx.request.body ?? {};

    const updated = await documentService(strapi).update({
      documentId: ctx.params.id,
      data:       { ...body, lastSavedAt: new Date() },
      populate:   ['owner', 'collaborators'],
    });

    return ctx.send({ data: updated });
  },

  // -------------------------------------------------------------------------
  // DELETE /api/documents/:id
  // Only owner can delete.
  // -------------------------------------------------------------------------
  async delete(ctx: any) {
    const strapi: Core.Strapi = (globalThis as any).strapi;
    const userId = getUserId(ctx);
    if (!userId) return ctx.unauthorized();

    const doc = await documentService(strapi).findOne({
      documentId: ctx.params.id,
      populate:   ['owner'],
    });

    if (!doc) return ctx.notFound();

    const ownerDocId = String(doc.owner?.documentId ?? doc.owner?.id ?? '');
    if (ownerDocId !== userId) {
      return ctx.forbidden('Only the document owner can delete it.');
    }

    await documentService(strapi).delete({ documentId: ctx.params.id });

    return ctx.send({ data: { documentId: ctx.params.id, deleted: true } });
  },

  // -------------------------------------------------------------------------
  // POST /api/documents/:id/share
  // Add a collaborator by email. Owner only.
  // -------------------------------------------------------------------------
  async share(ctx: any) {
    const strapi: Core.Strapi = (globalThis as any).strapi;
    const userId = getUserId(ctx);
    if (!userId) return ctx.unauthorized();

    const body  = ctx.request.body?.data ?? ctx.request.body ?? {};
    const email = body.email as string | undefined;
    if (!email) return ctx.badRequest('email is required');

    const doc = await documentService(strapi).findOne({
      documentId: ctx.params.id,
      populate:   ['owner', 'collaborators'],
    });

    if (!doc) return ctx.notFound();

    const ownerDocId = String(doc.owner?.documentId ?? doc.owner?.id ?? '');
    if (ownerDocId !== userId) {
      return ctx.forbidden('Only the owner can share this document.');
    }

    // Look up target user via low-level DB (works for plugin models)
    const targetUser: any = await strapi.db!
      .query('plugin::users-permissions.user')
      .findOne({ where: { email } });

    if (!targetUser) {
      return ctx.notFound('No CollabDoc account found with that email address.');
    }

    const existingIds = (doc.collaborators ?? []).map(
      (c: any) => String(c.documentId ?? c.id)
    );
    const targetId = String(targetUser.documentId ?? targetUser.id);

    if (!existingIds.includes(targetId)) {
      existingIds.push(targetId);
    }

    await documentService(strapi).update({
      documentId: ctx.params.id,
      data:       { collaborators: existingIds },
    });

    return ctx.send({ message: `Document shared with ${email}` });
  },
};
