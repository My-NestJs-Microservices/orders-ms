import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ChangeOrderStatusDto, CreateOrderDto, OrderPaginationDto, UpdateOrderDto } from './dto';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { PRODUCT_SERVICE } from 'src/config';
import { catchError, firstValueFrom } from 'rxjs';


@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {

  private readonly logger = new Logger('OrdersService');

  constructor(
    @Inject(PRODUCT_SERVICE) private readonly productsClient: ClientProxy
  ) {
    super()
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to the database');
  }

  async create(createOrderDto: CreateOrderDto) {
    try {

      const productsIds = createOrderDto.items.map(item => item.productId)

      const products = await firstValueFrom(
        this.productsClient.send({ cmd: 'validateProducts' }, productsIds)
      )


      const totalAmount = createOrderDto.items.reduce((acc, product) => {
        const price = products.find(p => p.id === product.productId).price

        return acc + (price * product.quantity)
      }, 0);

      const totalItems = createOrderDto.items.reduce((acc, item) => acc + item.quantity, 0);

      const order = await this.order.create({
        data: {
          totalAmount,
          totalItems,
          OrderItem: {
            createMany: {
              data: createOrderDto.items.map(item => ({
                quantity: item.quantity,
                productId: item.productId,
                price: products.find(p => p.id === item.productId).price
              }))
            }
          }
        },
        include: {
          OrderItem: {
            select: {
              price: true,
              quantity: true,
              productId: true
            }
          }
        }
      });

      return {
        ...order,
        OrderItem: order.OrderItem.map(item => ({
          ...item,
          name: products.find(p => p.id === item.productId).name
        }))
      }

    } catch (error) {
      throw new RpcException(error)
    }

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
      where: { id },
      include: {
        OrderItem: {
          select: {
            price: true,
            quantity: true,
            productId: true
          }
        }
      }
    })

    if (!order) throw new RpcException({
      message: `Order with id ${id} not found`,
      statusCode: HttpStatus.NOT_FOUND
    });

    const productsIds = order.OrderItem.map(item => item.productId)

    const products = await firstValueFrom(
      this.productsClient.send({ cmd: 'validateProducts' }, productsIds)
    )

    return {
      ...order,
      OrderItem: order.OrderItem.map(item => ({
        ...item,
        name: products.find(p => p.id === item.productId).name
      }))
    }
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
