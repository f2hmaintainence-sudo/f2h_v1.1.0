import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { CartDto, CheckOutDto } from '../dto/cart.dto';
import { CartService } from '../ModuleServices/cartAndCheckout.service';
import { Request } from 'express';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller({ path: 'customer', version: '1' })
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * The acting customer always comes from the token. `cart-sync` used to write to
   * whatever `customer_id` the body carried, so any authenticated user could
   * overwrite another user's cart — and checkout reads the cart back from the same
   * table, so the tampered contents were what got ordered.
   */
  @Post('/cart-sync')
  create(@Body() body: CartDto, @Req() req: Request) {
    return this.cartService.syncCart(body, (req.user as any)?.user_id);
  }

  @Get('/cart-items')
  getCartItems(@Req() req: Request) {
    return this.cartService.getCartItems((req.user as any)?.user_id);
  }

  @Post('/checkout/payment')
  async checkoutPayment(@Req() req: Request, @Body() body: CheckOutDto) {
    body.customer_id = (req.user as any)?.user_id;
    return this.cartService.checkout(body, req);
  }

  @Public()
  @Post('/coupon/validate')
  async validateCoupon(@Req() req: Request, @Body() body: { coupon_code: string; subtotal?: number }) {
    const customerId = (req.user as any)?.user_id;
    return this.cartService.validateCoupon(customerId, body.coupon_code, Number(body.subtotal || 0));
  }

  /** Coupons this customer can pick from, priced against the cart subtotal. */
  @Public()
  @Get('/coupons')
  async listCoupons(@Req() req: Request, @Query('subtotal') subtotal?: string) {
    const customerId = (req.user as any)?.user_id;
    return this.cartService.listCoupons(customerId, Number(subtotal || 0));
  }

  @Post('/checkout/preview-discounts')
  async previewDiscounts(@Req() req: Request, @Body() body: CheckOutDto) {
    const customerId = (req.user as any)?.user_id;
    return this.cartService.previewDiscounts(customerId, body);
  }
}
