import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserInterface } from 'src/interfaces/user.interface';
import {
  CreateUserResponse,
  FindUserResponse,
  UpdateUserResponse,
} from 'src/responses/users.responses';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';
import { File, FileDocument } from 'src/files/schema/file.schema';
import { ObjectId } from 'src/types/object-id';
import { SortType } from 'src/enums/sort.type';
import { UserType } from 'src/enums/user-type';
import { storageDir } from 'src/utils/storage';
import { FilesService } from '../files/files.service';
import { FindFilesResponse } from '../responses/files.responses';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(File.name) private fileModel: Model<FileDocument>,
    private readonly filesService: FilesService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<CreateUserResponse> {
    const { password, retypedPassword, login } = createUserDto;
    const user = await this.userModel.findOne({ login });
    if (user) {
      throw new BadRequestException(
        `Istnieje już użytkownik z loginem ${login}`,
      );
    }
    if (password !== retypedPassword) {
      throw new BadRequestException('Hasła się nie zgadzają');
    }
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    return this.filter(await this.userModel.create({ login, passwordHash }));
  }

  async findMany(sort?: SortType, page?: number) {
    const PER_PAGE = 9;
    const skip = (page - 1) * PER_PAGE;
    const users = await this.userModel
      .find({})
      .skip(skip)
      .limit(PER_PAGE)
      .sort({ updatedAt: sort ? sort : 'desc' });
    if (users.length === 0) {
      throw new NotFoundException(`Nie znaleziono użytkowników`);
    }
    const count = await this.userModel.countDocuments({}).exec();
    return {
      users: users.map((user) => this.filter(user)),
      requiredPages: Math.ceil(count / PER_PAGE),
      count,
      page,
    };
  }

  async findOne(id: ObjectId): Promise<FindUserResponse> {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('Nie znaleziono użytkownika');
    }
    return this.filter(user);
  }

  async findUserByNameWithFiles(
    name: string,
    {
      filters,
      page,
      sort,
      perPage,
    }: { filters: any; page: number; sort: SortType; perPage: number },
  ) {
    const user = await this.findByLogin(name);

    filters.authorId = user._id;

    return await this.filesService.search({
      filters,
      page,
      sort,
      perPage,
    });
  }

  async findByLogin(login: string): Promise<FindUserResponse> {
    const user = await this.userModel.findOne({ login });
    if (!user) {
      throw new NotFoundException(
        `Nie znaleziono użytkownika o loginie ${login}`,
      );
    }
    return this.filter(user);
  }

  async update(
    id: ObjectId,
    updateUserDto: UpdateUserDto,
    updatingUser: UserInterface,
  ): Promise<UpdateUserResponse> {
    const user = await this.userModel.findById(id);

    const { login, retypedNewPassword, password, newPassword } = updateUserDto;

    if (
      user._id.toString() !== updatingUser._id.toString() &&
      updatingUser.type !== UserType.admin
    ) {
      throw new UnauthorizedException('Nie możesz edytować czyjegoś konta');
    }

    if (!user) {
      throw new NotFoundException('Nie znaleziono użytkownika');
    }

    if (newPassword !== retypedNewPassword) {
      throw new UnauthorizedException('Podane hasła nie są takie same');
    }

    const passwordsMatch = await bcrypt.compare(password, user.passwordHash);

    if (!passwordsMatch) {
      throw new UnauthorizedException('Podano błędne hasło');
    }

    const passwordHash = newPassword
      ? await bcrypt.hash(newPassword, await bcrypt.genSalt(10))
      : undefined;

    const checkLoginExist = login
      ? !!(await this.userModel.findOne({ login }))
      : false;
    if (checkLoginExist) {
      throw new BadRequestException(
        `Użytkownik o loginie ${login} już istnieje`,
      );
    }

    await this.userModel.updateOne({ _id: id }, { login, passwordHash });
    const updatedUser = await this.userModel.findById(id);

    if (login) {
      await this.fileModel.updateMany(
        { authorName: user.login },
        { authorName: login },
      );
    }

    return this.filter(updatedUser);
  }

  async changeUsersPermissions(
    id: ObjectId,
    prottingUser: UserInterface,
    newRole: 'normal' | 'moderator',
  ): Promise<UpdateUserResponse> {
    const user = await this.userModel.findById(id);
    if (prottingUser.type !== UserType.admin) {
      throw new UnauthorizedException(
        'Nie możesz promować innych użytkowników',
      );
    }

    if (user.type === UserType.admin) {
      throw new BadRequestException('Nie możesz promować admina');
    }

    await this.userModel.updateOne({ _id: id }, { type: newRole as UserType });

    const updatedUser = await this.userModel.findById(id);
    return this.filter(updatedUser);
  }

  async remove(id: ObjectId, deletingUser: UserInterface) {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('Nie znaleziono użytkownika');
    }
    if (
      user._id.toString() !== deletingUser._id.toString() &&
      deletingUser.type !== UserType.admin
    ) {
      throw new UnauthorizedException('Nie możesz usunąć czyjegoś konta');
    }
    const userFiles = await this.fileModel.find({ authorId: id });
    if (userFiles) {
      await Promise.all(
        userFiles.map(async (userFile) => {
          await fs.unlink(
            `${path.join(storageDir(), userFile.type)}/${userFile.fileName}`,
          );
        }),
      );
    }
    await this.fileModel.deleteMany({ authorId: id });
    return this.filter(await this.userModel.findByIdAndDelete(id));
  }

  private filter(user: any): UserInterface {
    const { login, createdAt, updatedAt, _id, type } = user;
    return {
      _id,
      login,
      createdAt,
      updatedAt,
      type,
    };
  }
}
