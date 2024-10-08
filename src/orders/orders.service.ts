import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateOrderDto, UpdateOrderDto } from './dto';
import { RpcException } from '@nestjs/microservices';
import { OrderPaginationDto } from './dto/order-pagination.dto';
import { ChangeOrderStatusDto } from './dto/change-order.status.dto';


@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {

  private readonly logger = new Logger('OrdersService');

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to the database');
  }

  create(createOrderDto: CreateOrderDto) {
    return this.order.create({
      data: createOrderDto
    })
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {

    const { page, limit, status } = orderPaginationDto;

    const totalOrders = await this.order.count({ where: { status } })

    return {
      data: await this.order.findMany({
        skip: (page - 1) * limit,
        take: limit,
        where: { status }
      }),
      meta: {
        page: page,
        total: totalOrders,
        lastPage: Math.ceil(totalOrders / limit)
      }
    }
  }

  async findOne(id: string) {
    const order = await this.order.findUnique({
      where: { id }
    })

    if (!order) throw new RpcException({
      message: `Order with id ${id} not found`,
      statusCode: HttpStatus.NOT_FOUND
    });

    return order;
  }

  async changeOrderStatus(changeOrderStatusDto: ChangeOrderStatusDto) {

    const { id, status } = changeOrderStatusDto

    const order = await this.findOne(id);

    if (order.status === status) return order;

    return await this.order.update({
      where: { id },
      data: { status }
    })
  }
}
