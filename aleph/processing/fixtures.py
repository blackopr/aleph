import os
import yaml
import unicodecsv

from aleph.core import db
from aleph.model import List, Entity, Selector

fixtures_path = os.path.join(os.path.dirname(__file__), '..', '..', 'data',
                             'list_fixtures')


def load_fixture(name):
    dir_name = os.path.join(fixtures_path, name)
    if not os.path.isdir(dir_name):
        raise ValueError("No such directory: %r" % dir_name)

    with open(os.path.join(dir_name, 'mapping.yaml'), 'rb') as fh:
        data = yaml.load(fh)

    lst = List.by_label(data.get('list'))
    if lst is None:
        lst = List.create({
            'label': data.get('list'),
            'public': data.get('public')
        })

    mapping = data.get('mapping')
    default_category = data.get('default_category')
    assert default_category in Entity.CATEGORIES, default_category

    with open(os.path.join(dir_name, 'data.csv'), 'rb') as fh:
        for row in unicodecsv.DictReader(fh):
            label = row.get(mapping.get('label', 'label'))
            category = row.get(mapping.get('category', 'category'))
            if label is None:
                continue
            if category not in Entity.CATEGORIES:
                category = default_category
            entity = Entity.by_normalized_label(label, lst)
            if entity is None:
                entity = Entity()
                entity.list = lst
                entity.label = label
            selector = row.get(mapping.get('selector', 'selector'))
            for text in [label, selector]:
                if text is None:
                    continue
                if entity.has_selector(text):
                    continue
                selector = Selector()
                selector.text = text
                selector.entity = entity
                entity.selectors.append(selector)
                db.session.add(selector)
            entity.category = category
            db.session.add(entity)

    db.session.commit()
    print lst
