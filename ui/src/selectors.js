import _ from 'lodash';


function selectResult(state, query, expand) {
  const key = query.toKey();
  const result = {
    isLoading: false,
    isError: false,
    shouldLoad: true,
    results: [],
    ...state.results[key],
  };
  result.results = result.results.map(id => expand(state, id));
  return result;
}

function selectObject(objects, id) {
  if (!id || !_.has(objects, id)) {
    return {
      isLoading: false,
      isError: false,
      shouldLoad: true,
    };
  }
  return objects[id];
}

export function selectLocale(state) {
  // determine the active locale to be used by the user interface. this is
  // either saved in localStorage or extracted from metadata. The initial
  // request to metadata will be sent with unmodified Accept-Language headers
  // allowing the backend to perform language negotiation.
  const { config, metadata } = state;
  if (config && config.locale) {
    return config.locale;
  }
  if (metadata && metadata.app) {
    return metadata.app.locale;
  }
  return undefined;
}

export function selectMetadata(state) {
  const metadata = selectObject(state, 'metadata');
  const locale = selectLocale(state);
  if (metadata.app && metadata.app.locale !== locale) {
    return selectObject(state, undefined);
  }
  return metadata;
}

export function selectSchemata(state) {
  const metadata = selectMetadata(state);
  return metadata.schemata || {};
}

export function selectStatistics(state) {
  return selectObject(state, 'statistics');
}

export function selectSession(state) {
  return selectObject(state, 'session');
}

export function selectAlerts(state) {
  return selectObject(state, 'alerts');
}

export function selectCollection(state, collectionId) {
  // get a collection from the store.
  return selectObject(state.collections, collectionId);
}

export function selectEntity(state, entityId) {
  // get a collection from the store.
  return selectObject(state.entities, entityId);
}


export function selectDocumentContent(state, documentId) {
  return selectObject(state.documentContent, documentId);
}

export function selectCollectionsResult(state, query) {
  return selectResult(state, query, selectCollection);
}

export function selectEntitiesResult(state, query) {
  return selectResult(state, query, selectEntity);
}


export function selectNotificationsResult(state, query) {
  return selectResult(state, query, (stateInner, id) => stateInner.notifications[id]);
}

export function selectEntityTags(state, entityId) {
  return selectObject(state.entityTags, entityId);
}

export function selectEntityReferences(state, entityId) {
  return selectObject(state.entityReferences, entityId);
}

export function selectEntityReference(state, entityId, qname) {
  const references = selectEntityReferences(state, entityId);
  if (!references.total) {
    return undefined;
  }

  return references.results
    .find(ref => ref.property.qname === qname) || references.results[0];
}

export function selectEntityView(state, entityId, mode, isPreview) {
  if (mode) {
    return mode;
  }
  if (isPreview) {
    return 'info';
  }
  const references = selectEntityReferences(state, entityId);
  if (references.total) {
    return references.results[0].property.qname;
  }
  return undefined;
}

export function selectDocumentView(state, documentId, mode) {
  if (mode) {
    return mode;
  }
  const document = selectEntity(state, documentId);
  const has = s => _.intersection(document.schemata, s).length > 0;
  if (has(['Email', 'HyperText', 'Image', 'Pages', 'Table'])) {
    return 'view';
  }
  if (has(['Folder'])) {
    return 'browse';
  }
  return 'view';
}

export function selectCollectionView(state, collectionId, mode, isPreview) {
  if (mode) {
    return mode;
  }
  if (isPreview) {
    return 'info';
  }
  const collection = selectCollection(state, collectionId);
  let largestSchema = 'Document'; let
    largestCount = 0;
  const schemata = {};

  Object.keys(collection.schemata || {})
    .forEach((key) => {
      const norm = state.metadata.schemata.getSchema(key).isDocument() ? 'Document' : key;
      schemata[norm] = (schemata[norm] || 0) + collection.schemata[key];
      if (schemata[norm] > largestCount) {
        largestCount = schemata[norm];
        largestSchema = norm;
      }
    });
  return largestSchema; // yay.
}

export function selectCollectionPermissions(state, collectionId) {
  return selectObject(state.collectionPermissions, collectionId);
}

export function selectCollectionXrefIndex(state, collectionId) {
  return selectObject(state.collectionXrefIndex, collectionId);
}

export function selectCollectionXrefMatches(state, query) {
  return selectObject(state.collectionXrefMatches, query.toKey());
}

export function selectQueryLog(state) {
  return selectObject(state, 'queryLogs');
}

export function selectQueryLogsLimited(state, limit = 9) {
  const queryLogs = selectQueryLog(state);
  let results = [];
  if (queryLogs.results) {
    results = queryLogs.results.slice(0, limit);
  }
  return {
    ...queryLogs,
    results,
  };
}
