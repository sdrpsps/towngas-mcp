export class TowngasError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class TowngasRequestError extends TowngasError {}

export class TowngasTimeoutError extends TowngasRequestError {}

export class TowngasApiError extends TowngasError {
  details: any;

  constructor(message, details = {}) {
    super(message);
    this.details = details;
  }
}

export class TowngasAuthError extends TowngasApiError {}

export class TowngasParseError extends TowngasError {
  details: any;

  constructor(message, details = {}) {
    super(message);
    this.details = details;
  }
}
