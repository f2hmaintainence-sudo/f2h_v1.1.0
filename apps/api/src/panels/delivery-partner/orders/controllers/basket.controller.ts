import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../auth/jwt-auth.guard';
import { BasketService } from '../services/basket.service';

@Controller({ path: ['delivery-partner/basket', 'delivery/basket'], version: '1' })
@UseGuards(JwtAuthGuard)
export class BasketController {
  constructor(private readonly basketService: BasketService) {}

  @Get('active')
  async getActiveBasket(@Request() req: any, @Query('run_id') runId?: string) {
    const userId = req.user?.user_id;
    return this.basketService.getOrCreateActiveBasket(userId, runId);
  }

  @Get('summary')
  async getBasketSummary(@Request() req: any, @Query('run_id') runId?: string) {
    const userId = req.user?.user_id;
    return this.basketService.getBasketSummary(userId, runId);
  }

  @Post('reconcile')
  @HttpCode(HttpStatus.OK)
  async reconcileBasket(@Request() req: any, @Body() body: any) {
    const userId = req.user?.user_id;
    const basketId = body.basket_id || body.basketId;
    return this.basketService.reconcileBasket(basketId, userId, body.notes);
  }

  @Post('products/return-hub')
  @HttpCode(HttpStatus.OK)
  async returnProductsToHub(@Request() req: any, @Body() body: any) {
    const userId = req.user?.user_id;
    return this.basketService.returnProductsToHub(userId, body);
  }

  @Get('containers/summary')
  async getContainerSummary(@Request() req: any, @Query('run_id') runId?: string) {
    const userId = req.user?.user_id;
    return this.basketService.getContainerSummary(userId, runId);
  }

  @Post('containers/submit-hub')
  @HttpCode(HttpStatus.OK)
  async submitContainersToHub(@Request() req: any, @Body() body: any) {
    const userId = req.user?.user_id;
    return this.basketService.submitAllContainersToHub(userId, body);
  }

  @Post('containers/submit-all')
  @HttpCode(HttpStatus.OK)
  async submitAllContainers(@Request() req: any, @Body() body: any) {
    const userId = req.user?.user_id;
    return this.basketService.submitAllContainersToHub(userId, body);
  }
}
