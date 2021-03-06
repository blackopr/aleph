from banal import ensure_list, keys_values
from flask import Blueprint, request
from werkzeug.exceptions import BadRequest
from followthemoney import model
from followthemoney.exc import InvalidMapping

from aleph.core import db, settings
from aleph.authz import Authz
from aleph.model import Role, Audit, Collection
from aleph.search import CollectionsQuery
from aleph.logic.collections import create_collection, refresh_collection
from aleph.logic.collections import delete_collection, update_collection
from aleph.logic.documents import process_documents
from aleph.logic.entities import bulk_load_query, bulk_write
from aleph.logic.audit import record_audit
from aleph.logic.util import collection_url
from aleph.views.cache import enable_cache
from aleph.views.forms import CollectionCreateSchema, CollectionUpdateSchema
from aleph.views.serializers import CollectionSerializer
from aleph.views.util import get_db_collection, get_index_collection
from aleph.views.util import require, parse_request
from aleph.views.util import render_xml, get_flag

blueprint = Blueprint('collections_api', __name__)


@blueprint.route('/api/2/collections', methods=['GET'])
def index():
    result = CollectionsQuery.handle(request)
    return CollectionSerializer.jsonify_result(result)


@blueprint.route('/api/2/sitemap.xml')
def sitemap():
    enable_cache(vary_user=False)
    collections = []
    for collection in Collection.all_authz(Authz.from_role(None)):
        updated_at = collection.updated_at.date().isoformat()
        updated_at = max(settings.SITEMAP_FLOOR, updated_at)
        collections.append({
            'url': collection_url(collection.id),
            'updated_at': updated_at
        })
    return render_xml('sitemap.xml', collections=collections)


@blueprint.route('/api/2/collections', methods=['POST', 'PUT'])
def create():
    require(request.authz.logged_in)
    data = parse_request(CollectionCreateSchema)
    role = Role.by_id(request.authz.id)
    sync = get_flag('sync')
    collection = create_collection(data, role=role, sync=sync)
    return CollectionSerializer.jsonify(collection)


@blueprint.route('/api/2/collections/<int:id>', methods=['GET'])
def view(id):
    collection = get_index_collection(id)
    record_audit(Audit.ACT_COLLECTION, id=id)
    return CollectionSerializer.jsonify(collection)


@blueprint.route('/api/2/collections/<int:id>', methods=['POST', 'PUT'])
def update(id):
    collection = get_db_collection(id, request.authz.WRITE)
    data = parse_request(CollectionUpdateSchema)
    sync = get_flag('sync')
    collection.update(data)
    db.session.commit()
    data = update_collection(collection, sync=sync)
    return CollectionSerializer.jsonify(data)


@blueprint.route('/api/2/collections/<int:id>/process', methods=['POST', 'PUT'])  # noqa
def process(id):
    collection = get_db_collection(id, request.authz.WRITE)
    # re-process the documents
    process_documents.delay(collection_id=collection.id)
    return ('', 204)


@blueprint.route('/api/2/collections/<int:id>/mapping', methods=['POST', 'PUT'])  # noqa
def mapping_process(id):
    collection = get_db_collection(id, request.authz.WRITE)
    require(request.authz.can_bulk_import())
    # TODO: we need to look into possible abuse of mapping load path for local
    # path access on the machine running the mapping. Until then, this action
    # must be restricted to admins:
    require(request.authz.is_admin)
    if not request.is_json:
        raise BadRequest()
    data = request.get_json().get(collection.foreign_id)
    for query in keys_values(data, 'queries', 'query'):
        try:
            model.make_mapping(query)
            bulk_load_query.apply_async([collection.id, query], priority=6)
        except InvalidMapping as invalid:
            raise BadRequest(invalid)
    return ('', 204)


@blueprint.route('/api/2/collections/<int:id>/_bulk', methods=['POST'])
def bulk(id):
    collection = get_db_collection(id, request.authz.WRITE)
    require(request.authz.can_bulk_import())
    merge = get_flag('merge', default=False)
    entities = ensure_list(request.get_json(force=True))
    bulk_write(collection, entities, merge=merge)
    refresh_collection(id)
    return ('', 204)


@blueprint.route('/api/2/collections/<int:id>', methods=['DELETE'])
def delete(id):
    collection = get_db_collection(id, request.authz.WRITE)
    sync = get_flag('sync', default=True)
    delete_collection(collection, sync=sync)
    return ('', 204)
