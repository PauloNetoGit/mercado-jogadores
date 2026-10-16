
import {
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
} from 'class-validator';

export class CreatePlayerDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[^\d]*$/, {
    message: 'name não pode conter dígitos',
  })
  @Matches(/^\S+ +\S+(?: +\S+)*$/, {
    message: 'name deve conter pelo menos duas palavras',
  })
  name: string;

  @IsIn(['GOL', 'ZAG', 'LAT', 'MEI', 'ATA'])
  position: 'GOL' | 'ZAG' | 'LAT' | 'MEI' | 'ATA';

  @IsInt()
  @Min(1)
  @Max(100)
  agility: number;

  @IsInt()
  @Min(16)
  @Max(45)
  age: number;

  @IsInt()
  @Min(1)
  @Max(99)
  pace: number;

  @IsInt()
  @Min(1)
  @Max(99)
  shooting: number;

  @IsInt()
  @Min(1)
  @Max(99)
  passing: number;

  @IsInt()
  @Min(1)
  @Max(99)
  dribbling: number;

  @IsInt()
  @Min(1)
  @Max(99)
  defending: number;

  @IsInt()
  @Min(1)
  @Max(99)
  physical: number;

  @IsInt()
  @Min(1)
  @Max(99)
  potential: number;
}
