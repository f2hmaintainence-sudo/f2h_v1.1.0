export class OrderDeliveredEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly deliveredAt: Date = new Date(),
  ) {}
}
