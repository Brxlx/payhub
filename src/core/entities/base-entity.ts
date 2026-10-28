import { ID } from './id';

export abstract class BaseEntity<Props> {
  private _id: ID;
  protected props: Props;

  get id() {
    return this._id;
  }

  protected constructor(props: Props, id?: ID) {
    this.props = props;
    this._id = id ?? new ID(id);
  }

  public equals(entity: BaseEntity<unknown>) {
    if (entity === this) return true;

    if (entity._id === this._id) return true;

    return false;
  }
}
