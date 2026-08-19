<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class SBS_Importer_Services {
	/** @return int|WP_Error */
	public static function import_page( array $artifact, string $content, array $options ) {
		$page = $artifact['concept']['page'] ?? array();
		$title = sanitize_text_field( (string) ( $options['page_title'] ?? $page['title'] ?? __( 'Imported SBS Page', 'sbs-website-importer' ) ) );
		$status = in_array( $options['page_status'] ?? 'draft', array( 'draft', 'publish', 'private' ), true ) ? $options['page_status'] : 'draft';
		$page_id = absint( $options['page_id'] ?? 0 );
		$mode = in_array( $options['page_mode'] ?? 'replace', array( 'replace', 'append' ), true ) ? $options['page_mode'] : 'replace';
		if ( $page_id ) {
			$post = get_post( $page_id );
			if ( ! $post || 'page' !== $post->post_type || ! current_user_can( 'edit_post', $page_id ) ) {
				return new WP_Error( 'sbs_page_target', __( 'The selected destination page is not available.', 'sbs-website-importer' ) );
			}
			$new_content = 'append' === $mode && trim( $post->post_content ) ? $post->post_content . "\n\n" . $content : $content;
			$result = wp_update_post( array( 'ID' => $page_id, 'post_content' => wp_slash( $new_content ), 'post_title' => $title ?: $post->post_title ), true );
		} else {
			$result = wp_insert_post( array( 'post_type' => 'page', 'post_status' => $status, 'post_title' => $title, 'post_name' => sanitize_title( $page['slug'] ?? $title ), 'post_content' => wp_slash( $content ) ), true );
		}
		if ( is_wp_error( $result ) ) {
			return $result;
		}
		update_post_meta( $result, '_sbs_imported_at', current_time( 'mysql', true ) );
		update_post_meta( $result, '_sbs_artifact_version', sanitize_text_field( (string) ( $artifact['artifactVersion'] ?? $artifact['schemaVersion'] ?? '' ) ) );
		update_post_meta( $result, '_sbs_pattern_flow', sanitize_text_field( (string) ( $page['flow']['id'] ?? '' ) ) );
		return (int) $result;
	}

	/** @return int|WP_Error */
	public static function create_navigation_menu( array $artifact, string $title ) {
		$node = $artifact['concept']['global']['navigation'] ?? $artifact['concept']['templateParts']['navigation'] ?? array();
		$items = $node['nav']['menu'] ?? array();
		$title = sanitize_text_field( $title ?: __( 'SBS Primary Navigation', 'sbs-website-importer' ) );
		$menu = wp_get_nav_menu_object( $title );
		if ( $menu ) {
			$menu_id = (int) $menu->term_id;
			foreach ( wp_get_nav_menu_items( $menu_id ) ?: array() as $item ) {
				wp_delete_post( $item->ID, true );
			}
		} else {
			$menu_id = wp_create_nav_menu( $title );
			if ( is_wp_error( $menu_id ) ) {
				return $menu_id;
			}
		}
		foreach ( $items as $position => $item ) {
			if ( ! is_array( $item ) || empty( $item['label'] ) ) {
				continue;
			}
			$menu_item = wp_update_nav_menu_item(
				$menu_id,
				0,
				array(
					'menu-item-title'     => sanitize_text_field( (string) $item['label'] ),
					'menu-item-url'       => esc_url_raw( (string) ( $item['url'] ?? '#' ) ),
					'menu-item-status'    => 'publish',
					'menu-item-type'      => 'custom',
					'menu-item-position'  => (int) $position + 1,
				)
			);
			if ( is_wp_error( $menu_item ) ) {
				return $menu_item;
			}
		}
		return (int) $menu_id;
	}

	/** @return int|WP_Error */
	public static function upsert_template_part( string $slug, string $title, string $area, string $content ) {
		$slug = sanitize_title( $slug );
		$area = in_array( $area, array( 'header', 'footer', 'uncategorized' ), true ) ? $area : 'uncategorized';
		$theme = get_stylesheet();
		$existing = get_posts(
			array(
				'post_type'      => 'wp_template_part',
				'post_status'    => array( 'publish', 'draft', 'auto-draft' ),
				'name'           => $slug,
				'posts_per_page' => 1,
				'fields'         => 'ids',
				'tax_query'      => array(
					array( 'taxonomy' => 'wp_theme', 'field' => 'name', 'terms' => $theme ),
				),
			)
		);
		$postarr = array( 'post_type' => 'wp_template_part', 'post_status' => 'publish', 'post_name' => $slug, 'post_title' => sanitize_text_field( $title ), 'post_content' => wp_slash( $content ) );
		if ( $existing ) {
			$postarr['ID'] = (int) $existing[0];
			$id = wp_update_post( $postarr, true );
		} else {
			$id = wp_insert_post( $postarr, true );
		}
		if ( is_wp_error( $id ) ) {
			return $id;
		}
		$theme_terms = wp_set_object_terms( $id, $theme, 'wp_theme', false );
		if ( is_wp_error( $theme_terms ) ) {
			return $theme_terms;
		}
		$area_terms = wp_set_object_terms( $id, $area, 'wp_template_part_area', false );
		if ( is_wp_error( $area_terms ) ) {
			return $area_terms;
		}
		update_post_meta( $id, 'origin', 'sbs-website-importer' );
		update_post_meta( $id, '_sbs_imported_at', current_time( 'mysql', true ) );
		return (int) $id;
	}

	public static function template_part_editor_url( string $slug ): string {
		$id = get_stylesheet() . '//' . sanitize_title( $slug );
		return admin_url( 'site-editor.php?postId=' . rawurlencode( $id ) . '&postType=wp_template_part&canvas=edit' );
	}

	public static function artifact_theme( array $artifacts ): array {
		foreach ( array( 'page', 'navigation', 'footer' ) as $type ) {
			if ( ! empty( $artifacts[ $type ]['concept']['theme'] ) && is_array( $artifacts[ $type ]['concept']['theme'] ) ) {
				return $artifacts[ $type ]['concept']['theme'];
			}
		}
		return array();
	}
}
