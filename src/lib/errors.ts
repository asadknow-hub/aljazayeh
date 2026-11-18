/**
 * A problem the person using the app can understand and fix: bad input, a
 * missing permission, a rule of the workflow. Its message is shown to them
 * as-is. Anything else that throws is a bug and is reported generically.
 */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}
