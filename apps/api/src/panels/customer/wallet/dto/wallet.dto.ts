import { IsNumber, IsPositive, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Typed so the global ValidationPipe actually validates. With `@Body() body: any`
 * there is no DTO metadata, `whitelist: true` strips nothing, and any field the
 * caller invents reaches the handler.
 */
export class WalletTopupDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  // An upper bound turns a fat-fingered or scripted credit into a rejected request
  // rather than an arbitrary balance.
  @Max(5000)
  amount: number;
}
