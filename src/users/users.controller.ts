import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  CreateUserResponse,
  FindManyUsersResponse,
  FindUserResponse,
  FindUserWithFiles,
} from 'src/responses/users.responses';
import * as mongoose from 'mongoose';
import { IdParamPipe } from '../pipes/id-param.pipe';
import { JwtAuthGuard } from '../auth/jtw-auth.guard';
import { UserInterface } from '../interfaces/user.interface';
import { UserObj } from 'src/decorators/user-object.decorator';
import { ObjectId } from 'src/types/object-id';
import { SortGuard } from 'src/guards/sort.guard';
import { SortType } from 'src/enums/sort.type';
import { ParsePagePipe } from 'src/pipes/parse-page.pipe';
import { FindFilesResponse } from '../responses/files.responses';
import { ChangeUsersPermissionsDto } from './dto/change-users-permissions.dto';
import { FilesService } from 'src/files/files.service';

@Controller('api/users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly filesService: FilesService,
  ) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto): Promise<CreateUserResponse> {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @UseGuards(SortGuard)
  findMany(
    @Query('sort') sort?: SortType,
    @Query('page', new ParsePagePipe(1)) page?: number,
  ): Promise<FindManyUsersResponse> {
    return this.usersService.findMany(sort, page);
  }

  @Get(':id')
  findOne(
    @Param('id', new IdParamPipe()) id: ObjectId,
  ): Promise<FindUserResponse> {
    return this.usersService.findOne(id);
  }

  @Get('/files/:name')
  findUsersFiles(
    @Param('name') name: string,
    @Req() req: any,
    @Query('page', new ParsePagePipe(1)) page: number,
    @Query('sort') sort?: SortType,
    @Query('per_page', new ParsePagePipe(9)) perPage?: number,
  ): Promise<FindFilesResponse> {
    return this.usersService
      .findUserByNameWithFiles(name, {
        filters: req.filters,
        page,
        sort,
        perPage,
      })
      .then((response) => ({
        ...response,
        files: response.files.map(this.filesService.filterFile),
      }));
  }

  @Get('login/:login')
  findByLogin(@Param('login') login: string): Promise<FindUserResponse> {
    return this.usersService.findByLogin(login);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', new IdParamPipe()) id: ObjectId,
    @Body() updateUserDto: UpdateUserDto,
    @UserObj() user: UserInterface,
  ) {
    return this.usersService.update(id, updateUserDto, user);
  }

  @Patch('changePerms/:id')
  @UseGuards(JwtAuthGuard)
  changeUsersPermissions(
    @Param('id', new IdParamPipe()) id: ObjectId,
    @Body() { newRole }: ChangeUsersPermissionsDto,
    @UserObj() user: UserInterface,
  ) {
    return this.usersService.changeUsersPermissions(id, user, newRole);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('id', new IdParamPipe()) id: ObjectId,
    @UserObj() user: UserInterface,
  ) {
    return this.usersService.remove(id, user);
  }
}
