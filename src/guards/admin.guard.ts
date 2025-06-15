import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    
    if (
      request.session?.user &&
      (request.session.user.role === 'admin' || 
       request.session.user.role === 'superadmin')
    ) {
      request.userRole = request.session.user.role;
      return true;
    }
    
    throw new ForbiddenException('Admin access required');
  }
}