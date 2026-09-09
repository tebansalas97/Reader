<script lang="ts">
  interface Props {
    images: string[];
  }

  const { images }: Props = $props();
</script>

<div class="printsheet" aria-hidden="true">
  {#each images as image, index (index)}
    <img src={image} alt="" />
  {/each}
</div>

<style>
  .printsheet {
    display: none;
  }
</style>
