import { ID } from './id';

describe('[ID] Test', () => {
  it('should be able to create a new EntityId', () => {
    const newEntityId = new ID();

    expect(newEntityId).toBeInstanceOf(ID);
  });

  it('should be able to create a new ID with specified id', () => {
    const newObjectId = new ID('id-test');
    const anotherObjectId = new ID();

    expect(newObjectId.toValue()).toEqual('id-test');
    expect(anotherObjectId.isValid()).toBeTruthy();
  });
  it('should be able to compare two ID', () => {
    const newObjectId = new ID('id-test');
    const anotherObjectId = new ID('id-test');
    expect(newObjectId.equals(anotherObjectId)).toBeTruthy();
  });
  it('should generate a valid cuid2 ID', () => {
    const newEntityId = new ID();

    expect(newEntityId.isValid()).toBeTruthy();
  });
  it('should generate a valid cuid2 ID with specified valid id', () => {
    const _id = 'qul9molibpg3293jwn2oc2lx';
    const newEntityId = new ID(_id);

    expect(newEntityId.toValue()).toEqual(_id);
    expect(newEntityId.isValid()).toBeTruthy();
  });
  it('should generate a valid cuid2 ID with specified id [non-cuid2 id](for some test cases)', () => {
    const _id = 'test-id';
    const newEntityId = new ID(_id);

    expect(newEntityId.toValue()).toEqual(_id);
    expect(newEntityId.isValid()).toBeFalsy();
  });
});
