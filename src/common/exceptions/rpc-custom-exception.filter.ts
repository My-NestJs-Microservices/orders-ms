import { Catch, ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { RpcException } from '@nestjs/microservices';

@Catch(RpcException)
export class RpcCustomExceptionFilter implements ExceptionFilter {
   catch(exception: RpcException, host: ArgumentsHost) {

      const ctx = host.switchToHttp();
      const res = ctx.getResponse();

      const rpcError = exception.getError();

      if (typeof (rpcError) === 'object' && 'statusCode' in rpcError && 'message' in rpcError) {
         const status = isNaN(+rpcError.statusCode) ? 400 : rpcError.statusCode;
         return res.status(status).json(rpcError);
      }

      res.status(400).json({
         statusCode: 400,
         error: rpcError
      });
   }
}