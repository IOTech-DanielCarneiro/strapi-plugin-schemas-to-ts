export class Logger {
  private verbose: boolean;
  constructor(verbose = false) {
    this.verbose = verbose;
  }

  public log(message: string): void {
    if (this.verbose) console.log(message);
  }
}
