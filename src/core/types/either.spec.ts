import { Either, left, right } from './either';

function doSomething(shouldSuccess: boolean): Either<number, boolean> {
  if (shouldSuccess) {
    return right(true);
  } else {
    return left(10);
  }
}

describe('Either tests', () => {
  it('should return success result', () => {
    const result = doSomething(true);

    expect(result.isRight()).toBeTruthy();
    expect(result.isLeft()).toBeFalsy();
  });

  it('should return error result', () => {
    const result = doSomething(false);

    expect(result.isLeft()).toBeTruthy();
    expect(result.isRight()).toBeFalsy();
  });
});
