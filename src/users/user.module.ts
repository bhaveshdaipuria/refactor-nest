import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UserControler } from "./user.controller";
import { userSchema } from "src/schemas/user.schema";

@Module({
  imports: [MongooseModule.forFeature([{ name: "User", schema: userSchema }])],
  controllers: [UserControler],
})
export class UserModule {}
