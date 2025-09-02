import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { TranslationService } from './translation.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService , TranslationService],
})
export class ProductsModule {}
