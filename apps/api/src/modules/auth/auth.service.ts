import { Injectable } from "@nestjs/common";

@Injectable()
export class AuthService {
  getStatus() {
    return {
      status: "auth-module-ready",
    };
  }
}
