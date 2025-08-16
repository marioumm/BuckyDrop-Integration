import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { WooCommerceHttpService } from '../shared/woocommerce-http.service';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly httpService: WooCommerceHttpService) {}

  async getCategories() {
    try {
      const response = await this.httpService.get('/products/categories');
      return response.data;
    } catch (error) {
      this.logger.error('Error fetching categories:', error.message);
      throw new HttpException(
        'Failed to fetch categories',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getProductTags() {
    try {
      const response = await this.httpService.get('/products/tags');
      return response.data;
    } catch (error) {
      this.logger.error('Error fetching product tags:', error.message);
      throw new HttpException(
        'Failed to fetch product tags',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getProductBrands() {
    try {
      const response = await this.httpService.get('/products/brands');
      return response.data;
    } catch (error) {
      this.logger.error('Error fetching product brands:', error.message);
      throw new HttpException(
        'Failed to fetch product brands',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
