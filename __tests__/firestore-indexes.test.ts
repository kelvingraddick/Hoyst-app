import firestoreIndexes from '../firestore.indexes.json';

function hasCollectionGroupFieldIndex(
  collectionGroup: string,
  fieldPath: string,
) {
  return firestoreIndexes.fieldOverrides.some(
    override =>
      override.collectionGroup === collectionGroup &&
      override.fieldPath === fieldPath &&
      override.indexes.some(
        index =>
          index.order === 'ASCENDING' &&
          index.queryScope === 'COLLECTION_GROUP',
      ),
  );
}

describe('Firestore collection-group indexes', () => {
  it('indexes Tap In effect reconciliation by inbox source key', () => {
    expect(hasCollectionGroupFieldIndex('inbox', 'sourceKey')).toBe(true);
  });

  it('indexes membership history for destructive account cleanup', () => {
    expect(hasCollectionGroupFieldIndex('membershipHistory', 'uid')).toBe(true);
  });
});
