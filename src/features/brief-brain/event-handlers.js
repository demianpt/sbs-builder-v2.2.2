import { SECTION_FAMILY_IDS } from '../../../shared/brief/families.mjs';
import { outlineFamilies } from '../../../shared/brief/planner.mjs';
import { briefBrainApi, normalizeApiError } from './api.js';
import {
  briefSignature,
  buildConceptsRequest,
  buildContentRequest,
  buildExpandRequest,
  buildMediaRequest,
  buildOutlineRequest,
  buildUnderstandRequest,
  beginJob,
  endJob,
  ensureBrainState,
  ensureMediaState,
  ensureSimpleState,
  isBrainBusy,
  isMediaBusy,
  isSimpleBusy,
} from './state.js';

/**
 * The Brief Brain's event layer.
 *
 * It owns network state and the brain's own project slice. Everything that
 * changes the page itself — sections, archetype, flow, history — is delegated
 * back to the builder through the context callbacks, so undo, autosave and the
 * live preview keep exactly one owner.
 */

function setBusy(brain, status, message, context) {
  // Registering the job is what allows a render to draw the working state; the
  // status alone is treated as stale left-over from a reload.
  beginJob(brain);
  brain.status = status;
  brain.liveMessage = message;
  brain.error = '';
  brain.errorCode = '';
  context.renderAll();
}

function settle(brain, message, context) {
  endJob(brain);
  brain.status = 'ready';
  brain.liveMessage = message;
  context.queueSave();
  context.renderAll();
  if (message) context.announce(message);
}

function fail(brain, error, context) {
  const normalized = normalizeApiError(error);
  endJob(brain);
  brain.status = 'error';
  brain.error = normalized.message;
  brain.errorCode = normalized.code;
  brain.liveMessage = normalized.message;
  context.queueSave();
  context.renderAll();
  context.announce(normalized.message);
}

async function refreshProvider(context, { announce = false } = {}) {
  const status = await briefBrainApi.status();
  // Re-read after the await: a render may have run while the probe was open.
  const brain = ensureBrainState(context.project);
  brain.provider = {
    configured: Boolean(status.configured),
    available: Boolean(status.available),
    model: String(status.model || ''),
    // Stock media is a second, independently configured service: the model can
    // be reachable while the picture library is not.
    stock: {
      configured: Boolean(status.media?.configured),
      available: Boolean(status.media?.available),
      images: Number(status.media?.images) || 0,
      videos: Number(status.media?.videos) || 0,
    },
  };
  context.queueSave();
  context.renderAll();
  if (announce) {
    context.announce(brain.provider.available
      ? `AI model reachable${brain.provider.model ? ` · ${brain.provider.model}` : ''}`
      : brain.provider.configured
        ? 'AI model is configured but unreachable. The built-in planner will answer.'
        : 'AI model is not configured. The built-in planner will answer.');
  }
}

async function runUnderstand(brain, context) {
  if (isBrainBusy(brain)) return;
  setBusy(brain, 'reading', 'Reading the brief…', context);
  try {
    const result = await briefBrainApi.understand(buildUnderstandRequest({
      project: context.project,
      archetypes: context.archetypes,
      flows: context.flows,
    }));
    brain.understanding = result;
    brain.understoodAt = new Date().toISOString();
    brain.understoodFrom = briefSignature(context.project.brief);
    if (result.degraded) {
      brain.liveMessage = result.degraded.message;
      settle(brain, result.degraded.message, context);
      return;
    }
    settle(brain, 'Brief understood. Check the readback, then apply what you agree with.', context);
  } catch (error) {
    fail(brain, error, context);
  }
}

/** The families the current page flow actually contains, in page order. */
function currentFamilies(context) {
  return (context.project.sections || [])
    .filter((section) => section.visible !== false)
    .map((section) => section.family)
    .filter((family) => SECTION_FAMILY_IDS.includes(family));
}

async function runContent(brain, context) {
  if (isBrainBusy(brain)) return;
  const families = currentFamilies(context);
  if (!families.length) {
    context.announce('Choose a page flow first, then generate the content.');
    return;
  }
  setBusy(brain, 'writing', 'Writing the first draft of every section…', context);
  try {
    const result = await briefBrainApi.content(buildContentRequest({ project: context.project, families }));
    brain.contentDraft = result;
    settle(brain, result.degraded
      ? result.degraded.message
      : `Draft ready for ${result.sections.length} section${result.sections.length === 1 ? '' : 's'}. Review it, then apply.`, context);
  } catch (error) {
    fail(brain, error, context);
  }
}

async function runOutline(brain, context) {
  if (isBrainBusy(brain)) return;
  const outline = String(brain.outline || '').trim();
  if (outline.length < 3) {
    context.announce('Type the sections you want before building the flow.');
    return;
  }
  setBusy(brain, 'planning', 'Mapping your outline to DST sections…', context);
  try {
    const result = await briefBrainApi.outline(buildOutlineRequest({ project: context.project, outline }));
    brain.outlinePlan = result;
    const unresolved = (result.steps || []).filter((step) => !step.family).length;
    settle(brain, unresolved
      ? `${unresolved} line${unresolved === 1 ? '' : 's'} still need a section. Choose one for each.`
      : 'Outline mapped. Review the sequence, then create the flow.', context);
  } catch (error) {
    fail(brain, error, context);
  }
}

/* ---------------------------------------------------------------- *
 * Stock imagery
 * ---------------------------------------------------------------- */

/**
 * Finds on-brief stock imagery and places it across the page.
 *
 * The builder owns the slot list, because only it knows which pattern is on each
 * section and therefore how many pictures that section can hold. This handler
 * owns the request and the resulting project slice; applying the plan to the
 * sections is delegated back so undo, autosave and the preview keep one owner.
 */
async function runMedia(context) {
  const media = ensureMediaState(context.project);
  if (isMediaBusy(media)) return;
  const slots = context.mediaSlots();
  if (!slots.length) {
    context.announce('This page has no picture slots yet. Add a section that carries an image first.');
    return;
  }
  beginJob(media);
  media.status = 'searching';
  media.error = '';
  media.errorCode = '';
  media.liveMessage = 'Searching the stock library for this brief…';
  context.renderAll();
  try {
    const result = await briefBrainApi.media(buildMediaRequest({ project: context.project, slots }));
    const next = endJob(ensureMediaState(context.project));
    next.status = 'ready';
    next.assets = result.assets || [];
    next.assignments = result.assignments || [];
    next.unassigned = result.unassigned || [];
    next.queries = result.queries || null;
    next.source = result.source || '';
    next.degraded = result.degraded || null;
    next.provider = result.provider || '';
    next.model = result.model || '';
    next.notice = result.notice || '';
    next.generatedAt = new Date().toISOString();
    next.generatedFrom = briefSignature(context.project.brief);
    context.applyMediaPlan({ assets: next.assets, assignments: next.assignments });
    const videos = next.assets.filter((asset) => asset.kind === 'video').length;
    const placed = next.assignments.length;
    const short = next.unassigned.length
      ? ` ${next.unassigned.length} slot${next.unassigned.length === 1 ? '' : 's'} kept the placeholder — the search did not return enough distinct assets to fill them without repeating one.`
      : '';
    const message = result.degraded
      ? `${result.degraded.message} Imagery was placed in slot order.${short}`
      : `${next.assets.length} previews found (${videos} video${videos === 1 ? '' : 's'}) and ${placed} placed.${short}`;
    next.liveMessage = message;
    context.queueSave();
    context.renderAll();
    context.announce(message);
  } catch (error) {
    const next = endJob(ensureMediaState(context.project));
    const normalized = normalizeApiError(error);
    next.status = 'error';
    next.error = normalized.message;
    next.errorCode = normalized.code;
    next.liveMessage = normalized.message;
    context.queueSave();
    context.renderAll();
    context.announce(normalized.message);
  }
}

/**
 * Fetches one named asset and adds it to the pool.
 *
 * Nothing is placed. The strategist asked for a specific picture, not for a
 * decision about where it goes, so it joins the pool and the module pickers pick
 * it up on the next render — the same shape and the same watermark as everything
 * the search found.
 */
async function runMediaAsset(context) {
  const media = ensureMediaState(context.project);
  if (media.lookupStatus === 'loading') return;
  const query = String(media.assetIdQuery || '').trim();
  if (!query) {
    context.announce('Paste a Shutterstock id or asset URL first.');
    return;
  }
  media.lookupStatus = 'loading';
  media.lookupError = '';
  context.renderAll();
  try {
    const result = await briefBrainApi.mediaAsset({ assetId: query });
    // Re-read after the await: a render may have replaced the slice meanwhile.
    const next = ensureMediaState(context.project);
    next.lookupStatus = 'idle';
    next.lookupError = '';
    const asset = result.asset;
    const already = next.assets.some((entry) => entry.id === asset.id);
    if (!already) next.assets = next.assets.concat([asset]);
    next.assetIdQuery = '';
    // The pool is what the pickers read, and a hand-picked asset is still a
    // watermarked comp, so the licence notice has to survive an empty search.
    if (!next.notice) next.notice = result.notice || '';
    if (!next.provider) next.provider = result.provider || '';
    const message = already
      ? `#${asset.assetId} is already in your imagery.`
      : `#${asset.assetId} added — pick it on any module's Media tab.`;
    next.liveMessage = message;
    context.queueSave();
    context.renderAll();
    context.announce(message);
  } catch (error) {
    const next = ensureMediaState(context.project);
    const normalized = normalizeApiError(error);
    next.lookupStatus = 'error';
    next.lookupError = normalized.message;
    context.queueSave();
    context.renderAll();
    context.announce(normalized.message);
  }
}

/* ---------------------------------------------------------------- *
 * The simple builder
 * ---------------------------------------------------------------- */

/**
 * Reads one paragraph and builds three concepts plus the five best flows.
 *
 * The concepts are stored but not applied: choosing one is the strategist's
 * decision and the step's exit condition, so nothing changes the preview until
 * they pick.
 */
async function runConcepts(context) {
  const simple = ensureSimpleState(context.project);
  if (isSimpleBusy(simple)) return;
  const briefText = String(simple.briefText || '').trim();
  if (briefText.length < 20) {
    context.announce('Write a few sentences about the project first.');
    return;
  }
  beginJob(simple);
  simple.status = 'reading';
  simple.error = '';
  simple.errorCode = '';
  simple.liveMessage = 'Reading the brief and building three concepts…';
  context.renderAll();
  try {
    const result = await briefBrainApi.concepts(buildConceptsRequest({
      project: context.project,
      archetypes: context.archetypes,
      flows: context.flows,
    }));
    const next = endJob(ensureSimpleState(context.project));
    const previousActive = next.active;
    const previousSlot = previousActive !== null ? next.concepts[previousActive]?.slot : null;
    next.status = 'ready';
    next.readback = result.readback;
    next.fields = result.fields;
    next.confidence = result.confidence;
    next.missingFields = result.missingFields || [];
    next.concepts = context.normalizeConcepts(result.concepts);
    next.flows = result.flows || [];
    next.source = result.source;
    next.directives = result.directives || null;
    next.degraded = result.degraded || null;
    next.model = result.model || '';
    next.generatedAt = new Date().toISOString();
    next.generatedFrom = briefText;
    // Re-reading a brief should not silently abandon the concept already on
    // screen: keep the same slot selected and re-apply it.
    const sameSlot = previousSlot ? next.concepts.findIndex((concept) => concept.slot === previousSlot) : -1;
    next.active = sameSlot >= 0 ? sameSlot : null;
    // The brief text is also the advanced builder's brief, so mirror the fields
    // across now rather than at export time.
    context.applyBriefFields(result.fields, { briefText });
    if (next.active !== null) context.applyConcept(next.active, { silent: true });
    const message = result.degraded
      ? result.degraded.message
      : `${next.concepts.length} concepts ready. Pick one to continue.`;
    next.liveMessage = message;
    context.queueSave();
    context.renderAll();
    context.announce(message);
  } catch (error) {
    const next = endJob(ensureSimpleState(context.project));
    const normalized = normalizeApiError(error);
    next.status = 'error';
    next.error = normalized.message;
    next.errorCode = normalized.code;
    next.liveMessage = normalized.message;
    context.queueSave();
    context.renderAll();
    context.announce(normalized.message);
  }
}

/**
 * Handles every `data-brain-*` interaction. Returns true when the event was
 * consumed so the builder's own delegated listeners do not also act on it.
 */
export function handleBriefBrainEvent(event, context = {}) {
  const project = context.project;
  if (!project) return false;
  const brain = ensureBrainState(project);

  if (event.type === 'input' || event.type === 'change') {
    const field = event.target?.closest?.('[data-brain-field]');
    // The media slice has one typed field of its own. It is stored without a
    // re-render for the same reason the brief textarea is: the panel must not
    // rebuild itself under a cursor that is still typing.
    if (field && field.dataset.brainScope === 'media') {
      const media = ensureMediaState(project);
      media[field.dataset.brainField] = event.target.value;
      if (media.lookupError) media.lookupError = '';
      context.queueSave();
      return true;
    }
    if (field && field.dataset.brainScope === 'simple') {
      const simple = ensureSimpleState(project);
      simple[field.dataset.brainField] = event.target.value;
      context.queueSave();
      // Only the one primary button depends on this value; patch it rather than
      // re-rendering the textarea the strategist is typing into.
      const trigger = document.querySelector('[data-brain-action="build-concepts"]');
      if (trigger) {
        const blocked = String(simple.briefText || '').trim().length < 20;
        trigger.disabled = blocked;
        if (blocked) trigger.setAttribute('aria-disabled', 'true');
        else trigger.removeAttribute('aria-disabled');
      }
      const counter = document.querySelector('.brief-checklist em');
      if (counter) counter.textContent = `${String(simple.briefText || '').trim().length} / 4000 characters`;
      return true;
    }
    if (field) {
      brain[field.dataset.brainField] = event.target.value;
      context.queueSave();
      // Only the primary button's disabled state depends on this value, so
      // patch it in place instead of re-rendering the textarea mid-typing.
      // `aria-disabled` has to move with it, or the button is announced as
      // disabled while being clickable.
      const trigger = document.querySelector('[data-brain-action="plan-outline"]');
      if (trigger) {
        const blocked = String(brain.outline || '').trim().length < 3;
        trigger.disabled = blocked;
        if (blocked) trigger.setAttribute('aria-disabled', 'true');
        else trigger.removeAttribute('aria-disabled');
      }
      return true;
    }
    const familyPicker = event.target?.closest?.('[data-brain-action="outline-step-family"]');
    if (familyPicker) {
      const index = Number(familyPicker.dataset.brainIndex);
      const step = brain.outlinePlan?.steps?.[index];
      if (step) {
        step.family = SECTION_FAMILY_IDS.includes(familyPicker.value) ? familyPicker.value : null;
        step.reason = step.family ? 'Chosen by you.' : 'No section chosen yet.';
        context.queueSave();
        context.renderAll();
      }
      return true;
    }
    return false;
  }

  if (event.type !== 'click') return false;
  const trigger = event.target?.closest?.('[data-brain-action]');
  if (!trigger) return false;
  const action = trigger.dataset.brainAction;

  switch (action) {
    case 'check-provider':
      refreshProvider(context, { announce: true });
      return true;
    case 'understand':
      runUnderstand(brain, context);
      return true;
    case 'write-content':
      runContent(brain, context);
      return true;
    case 'plan-outline':
      runOutline(brain, context);
      return true;
    case 'build-concepts':
      runConcepts(context);
      return true;
    case 'find-media':
      runMedia(context);
      return true;
    case 'clear-media':
      context.clearMediaPlan();
      return true;
    case 'add-media-asset':
      runMediaAsset(context);
      return true;
    case 'copy-asset-id': {
      const id = String(trigger.dataset.brainAssetId || '');
      if (!id) return true;
      Promise.resolve(navigator.clipboard?.writeText(id))
        .then(() => context.announce(`Shutterstock id ${id} copied`))
        .catch(() => context.announce(`Shutterstock id ${id}`));
      return true;
    }
    case 'use-concept':
      context.applyConcept(Number(trigger.dataset.brainIndex));
      return true;
    case 'apply-archetype':
      context.applyArchetype(trigger.dataset.brainArchetype);
      return true;
    case 'apply-flow':
      context.applyFlow(trigger.dataset.brainFlow);
      return true;
    case 'apply-content': {
      const draft = brain.contentDraft;
      if (!draft?.sections?.length) return true;
      context.applyContentDraft(draft);
      brain.contentAppliedAt = new Date().toISOString();
      brain.liveMessage = 'Draft applied to every module in the flow.';
      context.queueSave();
      context.renderAll();
      return true;
    }
    case 'discard-content':
      brain.contentDraft = null;
      brain.liveMessage = 'Draft discarded.';
      context.queueSave();
      context.renderAll();
      return true;
    case 'apply-outline': {
      const families = outlineFamilies(brain.outlinePlan);
      if (!families.length) {
        context.announce('Choose a section for at least one line first.');
        return true;
      }
      context.applyCustomFlow({
        name: brain.outlinePlan?.name || 'Custom outline',
        rationale: brain.outlinePlan?.rationale || '',
        families,
      });
      brain.liveMessage = `Created a ${families.length}-section flow from your outline.`;
      context.queueSave();
      context.renderAll();
      return true;
    }
    case 'discard-outline':
      brain.outlinePlan = null;
      brain.liveMessage = 'Outline cleared.';
      context.queueSave();
      context.renderAll();
      return true;
    case 'outline-step-remove': {
      const index = Number(trigger.dataset.brainIndex);
      if (brain.outlinePlan?.steps?.length > index) {
        brain.outlinePlan.steps.splice(index, 1);
        context.queueSave();
        context.renderAll();
      }
      return true;
    }
    default:
      return false;
  }
}

/**
 * Splits the simple builder's paragraph into the advanced builder's fields.
 * Used by the import path, so it resolves rather than rendering.
 */
export async function expandBriefForImport(briefText) {
  try {
    return await briefBrainApi.expand(buildExpandRequest(briefText));
  } catch (error) {
    return { source: 'unavailable', error: normalizeApiError(error) };
  }
}

/** Called once at start-up so the panel can show the real provider state. */
export function initBriefBrain(context = {}) {
  const project = context.project;
  if (!project) return;
  ensureBrainState(project);
  refreshProvider(context).catch(() => {});
}
