import { auth } from "../../src/server/auth.js";

export default {
  fetch(request: Request) {
    return auth.handler(request);
  },
};
