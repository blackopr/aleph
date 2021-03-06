import React, { Component } from 'react';
import { defineMessages } from 'react-intl';
import queryString from 'query-string';

import Query from 'src/app/Query';
import Screen from 'src/components/Screen/Screen';
import EntityInfoMode from 'src/components/Entity/EntityInfoMode';
import DocumentContextLoader from 'src/components/Document/DocumentContextLoader';
import DocumentToolbar from 'src/components/Document/DocumentToolbar';
import DocumentHeading from 'src/components/Document/DocumentHeading';
import DocumentViews from 'src/components/Document/DocumentViews';
import LoadingScreen from 'src/components/Screen/LoadingScreen';
import ErrorScreen from 'src/components/Screen/ErrorScreen';
import { DualPane, Breadcrumbs, SearchBox } from 'src/components/common';
import { selectEntity, selectSchemata, selectDocumentView } from 'src/selectors';
import { enhancer } from 'src/util/enhancers';

const messages = defineMessages({
  placeholder: {
    id: 'documents.screen.filter',
    defaultMessage: 'Search in {label}',
  },
});


class DocumentScreen extends Component {
  constructor(props) {
    super(props);
    this.onSearch = this.onSearch.bind(this);
  }

  onSearch(queryText) {
    const { history, location, query } = this.props;
    const parsedHash = queryString.parse(location.hash);
    const newQuery = query.setString('q', queryText);
    parsedHash['preview:id'] = undefined;
    parsedHash['preview:type'] = undefined;
    parsedHash['preview:mode'] = undefined;
    parsedHash.page = undefined;
    history.push({
      pathname: location.pathname,
      search: newQuery.toLocation(),
      hash: queryString.stringify(parsedHash),
    });
  }

  render() {
    const {
      intl, document, documentId, activeMode, query,
    } = this.props;
    if (document.isError) {
      return <ErrorScreen error={document.error} />;
    }
    if (document.shouldLoad || document.isLoading) {
      return (
        <DocumentContextLoader documentId={documentId}>
          <LoadingScreen />
        </DocumentContextLoader>
      );
    }

    const title = document.title || document.file_name || document.name;
    const operation = !document.hasSearch() ? undefined : (
      <SearchBox
        onSearch={this.onSearch}
        searchPlaceholder={intl.formatMessage(messages.placeholder, { label: title })}
        searchText={query.getString('q')}
      />
    );
    const breadcrumbs = (
      <Breadcrumbs operation={operation}>
        <Breadcrumbs.Collection collection={document.collection} />
        <Breadcrumbs.Entity entity={document} />
      </Breadcrumbs>
    );

    return (
      <DocumentContextLoader documentId={documentId}>
        <Screen title={title}>
          {breadcrumbs}
          <DualPane>
            <DualPane.ContentPane className="view-menu-flex-direction">
              <DocumentViews
                document={document}
                activeMode={activeMode}
                isPreview={false}
              />
            </DualPane.ContentPane>
            <DualPane.InfoPane className="with-heading">
              <DocumentToolbar document={document} isPreview={false} />
              <DocumentHeading document={document} isPreview={false} />
              <div className="pane-content">
                <EntityInfoMode entity={document} isPreview={false} />
              </div>
            </DualPane.InfoPane>
          </DualPane>
        </Screen>
      </DocumentContextLoader>
    );
  }
}


const mapStateToProps = (state, ownProps) => {
  const { documentId } = ownProps.match.params;
  const { location } = ownProps;
  const hashQuery = queryString.parse(location.hash);
  return {
    documentId,
    document: selectEntity(state, documentId),
    query: Query.fromLocation('entities', location, {}, 'document'),
    schemata: selectSchemata(state),
    activeMode: selectDocumentView(state, documentId, hashQuery.mode),
  };
};

export default enhancer({ mapStateToProps })(DocumentScreen);
