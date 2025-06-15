import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class UserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const userTypes = ['user', 'admin', 'superadmin'];
    
    if (request.session?.user && userTypes.includes(request.session.user.role)) {
      request.userRole = request.session.user.role;
      request.allowedConst = request.session.user.allowedConstituencies;
      return true;
    }
    
    throw new ForbiddenException('Authentication required');
  }
}