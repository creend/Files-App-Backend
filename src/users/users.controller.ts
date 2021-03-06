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
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  CreateUserResponse,
  FindManyUsersResponse,
  FindUserResponse,
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

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('id', new IdParamPipe()) id: ObjectId,
    @UserObj() user: UserInterface,
  ) {
    return this.usersService.remove(id, user);
  }
}
