// apps/api/src/modules/staff/dto/update-staff-availability.dto.ts
/**
 * LAFAM Staff availability update DTO.
 *
 * Role:
 * - Validates admin staff availability replacement payloads.
 * - Ensures each availability rule has a valid day and time window.
 * - Ensures duplicate working days are not submitted.
 *
 * Important:
 * - This DTO does not query staff records.
 * - This DTO does not update the database.
 * - This DTO does not decide authorization.
 * - The Staff admin service remains responsible for checking staff existence,
 *   applying replacement behavior, and writing audit events.
 */

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  Validate,
  ValidateNested,
  type ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

import {
  STAFF_AVAILABILITY_MAX_RULES,
  STAFF_AVAILABILITY_MIN_RULES,
  STAFF_DAY_OF_WEEK_VALUES,
  STAFF_DEFAULT_AVAILABILITY_IS_AVAILABLE,
  STAFF_TIME_VALUE_PATTERN,
  type StaffDayOfWeek,
} from '../constants/staff.constants';

@ValidatorConstraint({
  name: 'StaffAvailabilityTimeOrder',
  async: false,
})
class StaffAvailabilityTimeOrderConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, validationArguments: ValidationArguments): boolean {
    const availabilityRule =
      validationArguments.object as Partial<StaffAvailabilityRuleDto>;

    if (
      typeof availabilityRule.start_time !== 'string' ||
      typeof availabilityRule.end_time !== 'string'
    ) {
      return false;
    }

    return availabilityRule.start_time < availabilityRule.end_time;
  }

  defaultMessage(): string {
    return 'end_time must be later than start_time.';
  }
}

export class StaffAvailabilityRuleDto {
  @Type(() => Number)
  @IsInt({ message: 'day_of_week must be an integer.' })
  @Min(0, { message: 'day_of_week must be at least 0.' })
  @Max(6, { message: 'day_of_week must be at most 6.' })
  @IsIn([...STAFF_DAY_OF_WEEK_VALUES], {
    message: 'day_of_week must be between 0 and 6.',
  })
  readonly day_of_week!: StaffDayOfWeek;

  @IsString({ message: 'start_time must be a string.' })
  @Matches(STAFF_TIME_VALUE_PATTERN, {
    message: 'start_time must use HH:mm 24-hour format.',
  })
  readonly start_time!: string;

  @IsString({ message: 'end_time must be a string.' })
  @Matches(STAFF_TIME_VALUE_PATTERN, {
    message: 'end_time must use HH:mm 24-hour format.',
  })
  @Validate(StaffAvailabilityTimeOrderConstraint)
  readonly end_time!: string;

  @IsOptional()
  @IsBoolean({ message: 'is_available must be a boolean.' })
  readonly is_available?: boolean = STAFF_DEFAULT_AVAILABILITY_IS_AVAILABLE;
}

export class UpdateStaffAvailabilityDto {
  @IsArray({ message: 'availability must be an array.' })
  @ArrayMinSize(STAFF_AVAILABILITY_MIN_RULES, {
    message: `availability must contain at least ${STAFF_AVAILABILITY_MIN_RULES} rule.`,
  })
  @ArrayMaxSize(STAFF_AVAILABILITY_MAX_RULES, {
    message: `availability must contain at most ${STAFF_AVAILABILITY_MAX_RULES} rules.`,
  })
  @ArrayUnique(
    (availabilityRule: StaffAvailabilityRuleDto) =>
      availabilityRule.day_of_week,
    {
      message: 'availability must not contain duplicate day_of_week values.',
    },
  )
  @ValidateNested({ each: true })
  @Type(() => StaffAvailabilityRuleDto)
  readonly availability!: StaffAvailabilityRuleDto[];
}
