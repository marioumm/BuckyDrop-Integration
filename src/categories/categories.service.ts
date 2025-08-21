/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, Logger, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { WooCommerceHttpService } from '../shared/woocommerce-http.service';

export interface CategoryWithSubcategories {
  id: number;
  name: string;
  slug: string;
  description: string;
  parent: number;
  count: number;
  image: any;
  review_count: number;
  permalink: string;
  subcategories: CategoryWithSubcategories[];
}

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

  async getCategoryWithSubcategories(categoryId: number): Promise<CategoryWithSubcategories> {
    try {
      const categoryResponse = await this.httpService.get(`/products/categories/${categoryId}`);
      const category = categoryResponse.data;

      if (!category) {
        throw new NotFoundException(`Category with ID ${categoryId} not found`);
      }

      const allCategoriesResponse = await this.httpService.get('/products/categories');
      const allCategories = allCategoriesResponse.data;

      const subcategories = allCategories.filter(
        (cat: any) => cat.parent === categoryId
      );

      return {
        ...category,
        subcategories: subcategories || []
      };

    } catch (error) {
      this.logger.error(`Error fetching category ${categoryId}:`, error.message);
      
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      throw new HttpException(
        `Failed to fetch category with ID ${categoryId}`,
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
