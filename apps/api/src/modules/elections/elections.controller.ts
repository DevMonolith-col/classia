import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from "@nestjs/common"
import { Request } from "express"
import { CurrentUser } from "../../common/decorators/current-user.decorator"
import { Permissions } from "../../common/decorators/permissions.decorator"
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard"
import { PermissionsGuard } from "../../common/guards/permissions.guard"
import { PERMISSIONS } from "../../common/permissions/permissions"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import { RequestUser } from "../../common/types/request-context"
import { ElectionsService } from "./elections.service"
import {
  AddCandidateInput,
  CastVoteInput,
  CreateElectionInput,
  UpdateElectionInput,
  UpdateElectionStatusInput,
  addCandidateSchema,
  castVoteSchema,
  createElectionSchema,
  updateElectionSchema,
  updateElectionStatusSchema,
} from "./elections.schemas"

@Controller("elections")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ElectionsController {
  constructor(private readonly elections: ElectionsService) {}

  @Post()
  @Permissions(PERMISSIONS.ELECTIONS_MANAGE)
  create(
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
    @Body(new ZodValidationPipe(createElectionSchema)) data: CreateElectionInput,
  ) {
    return this.elections.createElection(user, data, request)
  }

  @Get()
  @Permissions(PERMISSIONS.ELECTIONS_MONITOR)
  list(@CurrentUser() user: RequestUser) {
    return this.elections.listElections(user)
  }

  // Antes de ":id": si no, Nest interpreta "active" como un :id.
  @Get("active")
  @Permissions(PERMISSIONS.ELECTIONS_VOTE)
  listVotable(@CurrentUser() user: RequestUser) {
    return this.elections.listVotableElections(user)
  }

  @Get(":id")
  @Permissions(PERMISSIONS.ELECTIONS_MONITOR)
  getOne(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.elections.getElection(id, user)
  }

  @Put(":id")
  @Permissions(PERMISSIONS.ELECTIONS_MANAGE)
  update(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
    @Body(new ZodValidationPipe(updateElectionSchema)) data: UpdateElectionInput,
  ) {
    return this.elections.updateElection(id, user, data, request)
  }

  @Post(":id/candidates")
  @Permissions(PERMISSIONS.ELECTIONS_MANAGE)
  addCandidate(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
    @Body(new ZodValidationPipe(addCandidateSchema)) data: AddCandidateInput,
  ) {
    return this.elections.addCandidate(id, user, data, request)
  }

  @Delete(":id/candidates/:candidateId")
  @Permissions(PERMISSIONS.ELECTIONS_MANAGE)
  removeCandidate(
    @Param("id") id: string,
    @Param("candidateId") candidateId: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
  ) {
    return this.elections.deleteCandidate(id, candidateId, user, request)
  }

  @Patch(":id/status")
  @Permissions(PERMISSIONS.ELECTIONS_MANAGE)
  updateStatus(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
    @Body(new ZodValidationPipe(updateElectionStatusSchema)) data: UpdateElectionStatusInput,
  ) {
    return this.elections.updateStatus(id, user, data.status, request)
  }

  @Get(":id/ballot")
  @Permissions(PERMISSIONS.ELECTIONS_VOTE)
  getBallot(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.elections.getBallot(id, user)
  }

  @Post(":id/vote")
  @Permissions(PERMISSIONS.ELECTIONS_VOTE)
  vote(
    @Param("id") id: string,
    @CurrentUser() user: RequestUser,
    @Req() request: Request,
    @Body(new ZodValidationPipe(castVoteSchema)) data: CastVoteInput,
  ) {
    return this.elections.castVote(id, user, data.candidateId, request)
  }

  @Get(":id/participation")
  @Permissions(PERMISSIONS.ELECTIONS_MONITOR)
  getParticipation(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.elections.getParticipation(id, user)
  }

  // Sin @Permissions: el gate real está en el servicio (PUBLISHED = cualquier
  // miembro del tenant, CLOSED = solo Rector/Admin, ACTIVE/DRAFT = nadie).
  @Get(":id/results")
  getResults(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.elections.getResults(id, user)
  }
}
