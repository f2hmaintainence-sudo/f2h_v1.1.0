import 'package:equatable/equatable.dart';

abstract class CatalogEvent extends Equatable {
  const CatalogEvent();

  @override
  List<Object?> get props => [];
}

class LoadCatalog extends CatalogEvent {}

class SearchCatalog extends CatalogEvent {
  final String query;
  const SearchCatalog(this.query);

  @override
  List<Object?> get props => [query];
}

class LoadProductsByCategory extends CatalogEvent {
  final String categoryId;
  const LoadProductsByCategory(this.categoryId);

  @override
  List<Object?> get props => [categoryId];
}
