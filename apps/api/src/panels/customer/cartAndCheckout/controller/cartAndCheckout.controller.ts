import { Body, Controller, Get, Post, UseGuards, Req, Query, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Public } from 'src/auth/decorators/public.decorator';
import { CreateCartDto, CartDto, CheckOutDto } from '../dto/cart.dto';
import { CartService } from '../ModuleServices/cartAndCheckout.service';
import { Request } from 'express';

@Controller({ path: 'customer', version: '1' })
export class CartController {
  constructor(private readonly cartService: CartService) { }

  @UseGuards(AuthGuard('jwt'))
  @Post('/cart-sync')
  create(@Body() body: CartDto) {
    return this.cartService.syncCart(body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('/cart-items')
  getCartItems(
    @Req() req: Request
  ) {
    const user = req.user as any;
    const userId = user?.user_id;
    return this.cartService.getCartItems(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('/checkout/payment')
  async checkoutPayment(@Req() req: Request, @Body() body: CheckOutDto) {
    const user = req.user as any;
    const userId = user?.user_id;
    body.customer_id = userId;
    
    return this.cartService.checkout(body, req);
  }

}


