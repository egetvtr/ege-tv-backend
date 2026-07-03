import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'admin@egetv.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'sifre123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Ege TV Admin' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ enum: AdminRole, default: AdminRole.EDITOR })
  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;
}
