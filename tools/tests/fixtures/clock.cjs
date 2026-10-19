// Loaded only in isolated build-tool test processes, never by the site.
const RealDate = Date;
const instant = Date.parse(process.env.DN_TEST_TIME);
if (!Number.isFinite(instant)) throw new Error('DN_TEST_TIME must be an ISO instant');
global.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [instant])); }
  static now() { return instant; }
};
